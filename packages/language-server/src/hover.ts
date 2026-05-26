import { type Hover, type Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  getDeterministicDescription,
  getGraphContext,
  getInputDescription,
  getKeywordDescription,
  getNodeInstanceDescription,
  getNodeTypeDescription,
  getOutputDescription,
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
  const dotIndex = token.value.indexOf(".");
  const hoverOffset = position.character - token.startOffset;

  if (dotIndex >= 0) {
    const [root, property] = token.value.split(".", 2);
    if (property && hoverOffset > dotIndex) {
      const node = graphContext.nodes.find((candidate) => candidate.id === root);
      const outputDescription = node ? getOutputDescription(node.type, property) : undefined;
      if (outputDescription) {
        return {
          range: token.range,
          contents: makeMarkdown(outputDescription),
        };
      }
    }

    const rootNode = graphContext.nodes.find((candidate) => candidate.id === root);
    if (rootNode) {
      return {
        range: token.range,
        contents: makeMarkdown(getNodeInstanceDescription(rootNode)),
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

  const nodeTypeDescription = getNodeTypeDescription(token.value);
  if (nodeTypeDescription) {
    return {
      range: token.range,
      contents: makeMarkdown(nodeTypeDescription),
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
      contents: makeMarkdown(getNodeInstanceDescription(node)),
    };
  }

  const input = graphContext.inputs.find((candidate) => candidate.name === token.value);
  if (input) {
    return {
      range: token.range,
      contents: makeMarkdown(getInputDescription(input)),
    };
  }

  return undefined;
}
