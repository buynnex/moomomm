import { getNodeDefinition, resolveReferenceType } from "@momom/core";
import { type Hover, type Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { getMomomCursorContext } from "./context.js";
import {
  findBranchAtLine,
  findEdgeAtLine,
  getBranchSourceMarkdown,
  getDeterministicDescription,
  getEdgeConnectionMarkdown,
  getGraphContext,
  getInputDescription,
  getKeywordDescription,
  getNodeContractMarkdown,
  getNodeInstanceDescription,
  getParsedGraphAnalysis,
  getResolvedReferenceMarkdown,
  getRiskDescription,
  getTokenAtPosition,
  makeMarkdown,
} from "./utils.js";

export function getHover(document: TextDocument, position: Position): Hover | undefined {
  const token = getTokenAtPosition(document, position);
  if (!token) {
    return undefined;
  }

  const graphContext = getGraphContext(document);
  const cursorContext = getMomomCursorContext(document.getText(), position);
  const analysis = getParsedGraphAnalysis(document);

  if (analysis && ["edge-source", "edge-target", "edge-target-port"].includes(cursorContext.context)) {
    const edge = findEdgeAtLine(analysis.graph, position.line + 1);
    const edgeMarkdown = edge ? getEdgeConnectionMarkdown(edge, analysis.flow) : undefined;
    if (edgeMarkdown) {
      return {
        range: token.range,
        contents: makeMarkdown(edgeMarkdown),
      };
    }
  }

  if (analysis && cursorContext.context === "branch-source") {
    const branch = findBranchAtLine(analysis.graph, position.line + 1);
    const branchMarkdown = branch ? getBranchSourceMarkdown(branch.source, analysis.graph) : undefined;
    if (branchMarkdown) {
      return {
        range: token.range,
        contents: makeMarkdown(branchMarkdown),
      };
    }
  }

  if (analysis && token.value.includes(".")) {
    const referenceMarkdown = getResolvedReferenceMarkdown(token.value, analysis.graph);
    if (referenceMarkdown) {
      return {
        range: token.range,
        contents: makeMarkdown(referenceMarkdown),
      };
    }
  }

  const nodeTypeDefinition = getNodeDefinition(token.value);
  if (nodeTypeDefinition) {
    const contractMarkdown = getNodeContractMarkdown(token.value);
    if (contractMarkdown) {
      return {
        range: token.range,
        contents: makeMarkdown(contractMarkdown),
      };
    }
  }

  const keywordDescription = getKeywordDescription(token.value);
  if (keywordDescription) {
    return {
      range: token.range,
      contents: makeMarkdown(keywordDescription),
    };
  }

  const riskDescription = getRiskDescription(token.value);
  if (riskDescription) {
    return {
      range: token.range,
      contents: makeMarkdown(riskDescription),
    };
  }

  if (token.value === "deterministic") {
    return {
      range: token.range,
      contents: makeMarkdown(getDeterministicDescription()),
    };
  }

  const node = graphContext.nodes.find((candidate) => candidate.id === token.value);
  if (node) {
    return {
      range: token.range,
      contents: makeMarkdown(getNodeInstanceDescription(node, analysis?.flow)),
    };
  }

  const input = graphContext.inputs.find((candidate) => candidate.name === token.value);
  if (input) {
    return {
      range: token.range,
      contents: makeMarkdown(getInputDescription(input)),
    };
  }

  if (analysis && token.value.includes(".")) {
    const resolution = resolveReferenceType({ reference: token.value, graph: analysis.graph });
    if (resolution.ok) {
      return {
        range: token.range,
        contents: makeMarkdown(
          [
            `resolved type: ${resolution.type.raw}`,
            resolution.sourceKind === "node-output" ? `source node: ${resolution.node?.id ?? "<unknown>"}` : "source kind: input",
          ].join("\n"),
        ),
      };
    }
  }

  return undefined;
}
