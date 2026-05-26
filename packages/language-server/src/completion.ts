import { getNodeDefinition, resolveNodeContract, type NodeAst } from "@momom/core";
import { CompletionItemKind, type CompletionItem, type Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { getMomomCursorContext } from "./context.js";
import {
  findNodeById,
  getBooleanOutputReferences,
  getGraphContext,
  getKnownInputTypeSuggestions,
  getKnownNodeTypes,
  getNodeContractMarkdown,
  getNodeOutputReferences,
  getNodePropertyNames,
  makeMarkdown,
} from "./utils.js";

const TOP_LEVEL_KEYWORDS = ["input", "node", "edge", "branch", "output"];
const RISK_VALUES = ["low", "medium", "high", "critical"];

export function getCompletionItems(document: TextDocument, position: Position): CompletionItem[] {
  const items = new Map<string, CompletionItem>();
  const graphContext = getGraphContext(document);
  const cursorContext = getMomomCursorContext(document.getText(), position);

  const addItem = (item: CompletionItem): void => {
    if (!items.has(item.label)) {
      items.set(item.label, item);
    }
  };

  const addLabels = (labels: string[], kind: CompletionItemKind, detail: string): void => {
    for (const label of labels) {
      addItem({
        label,
        kind,
        detail,
      });
    }
  };

  switch (cursorContext.context) {
    case "top-level":
      addLabels(TOP_LEVEL_KEYWORDS, CompletionItemKind.Keyword, "Top-level Momom statement");
      break;
    case "input-type":
      addLabels(getKnownInputTypeSuggestions(), CompletionItemKind.TypeParameter, "Input type");
      break;
    case "node-type":
      addKnownNodeTypeItems(addItem);
      break;
    case "node-property-name":
    case "node-body":
      addLabels(
        getNodePropertyNames(cursorContext.nodeType),
        CompletionItemKind.Property,
        `Property for ${cursorContext.nodeType ?? "current node"}`,
      );
      break;
    case "node-property-value":
      addNodePropertyValueItems(addItem, cursorContext.propertyName);
      break;
    case "edge-source":
    case "output-reference":
      addLabels(graphContext.inputs.map((input) => input.name), CompletionItemKind.Variable, "Graph input");
      addLabels(getNodeOutputReferences(graphContext.nodes), CompletionItemKind.Property, "Known node output reference");
      break;
    case "edge-target":
    case "branch-case-target":
      addLabels(graphContext.nodes.map((node) => node.id), CompletionItemKind.Function, "Known node id");
      break;
    case "edge-target-port":
      addNodePortItems(addItem, findNodeById(graphContext.nodes, cursorContext.nodeId ?? ""));
      break;
    case "branch-source":
      addLabels(getBooleanOutputReferences(graphContext.nodes), CompletionItemKind.Property, "Boolean output reference");
      break;
    case "output-reference-property":
      addNodeOutputItems(addItem, findNodeById(graphContext.nodes, cursorContext.referenceRoot ?? ""));
      break;
    default:
      addLabels(TOP_LEVEL_KEYWORDS, CompletionItemKind.Keyword, "Momom keyword");
      addKnownNodeTypeItems(addItem);
      break;
  }

  return [...items.values()];
}

function addKnownNodeTypeItems(addItem: (item: CompletionItem) => void): void {
  for (const nodeType of getKnownNodeTypes()) {
    addItem({
      label: nodeType,
      kind: CompletionItemKind.Class,
      detail: "Known Momom node type",
      documentation: makeMarkdown(getNodeContractMarkdown(nodeType) ?? nodeType),
    });
  }
}

function addNodePortItems(addItem: (item: CompletionItem) => void, node: NodeAst | undefined): void {
  if (!node) {
    return;
  }

  const contract = resolveNodeContract(node);
  for (const inputContract of contract?.inputs ?? []) {
    addItem({
      label: inputContract.name,
      kind: CompletionItemKind.Field,
      detail: `Input port for ${node.type}`,
    });
  }
}

function addNodeOutputItems(addItem: (item: CompletionItem) => void, node: NodeAst | undefined): void {
  if (!node) {
    return;
  }

  for (const [outputName, outputType] of Object.entries(getNodeDefinition(node.type)?.outputs ?? {})) {
    addItem({
      label: outputName,
      kind: CompletionItemKind.Property,
      detail: `Known output for ${node.type}`,
      documentation: makeMarkdown(`\`${outputName}: ${outputType}\` from \`${node.type}\`.`),
    });
  }
}

function addNodePropertyValueItems(addItem: (item: CompletionItem) => void, propertyName: string | undefined): void {
  if (propertyName === "risk") {
    addLabelsWithDocumentation(addItem, RISK_VALUES.map((risk) => `"${risk}"`), CompletionItemKind.Value, "Risk value");
    return;
  }

  if (propertyName === "deterministic") {
    addLabelsWithDocumentation(addItem, ["true", "false"], CompletionItemKind.Value, "Boolean value");
    return;
  }

  if (propertyName === "template") {
    addLabelsWithDocumentation(addItem, ['"Ola, {name}"'], CompletionItemKind.Value, "Template example");
  }
}

function addLabelsWithDocumentation(
  addItem: (item: CompletionItem) => void,
  labels: string[],
  kind: CompletionItemKind,
  detail: string,
): void {
  for (const label of labels) {
    addItem({
      label,
      kind,
      detail,
    });
  }
}
