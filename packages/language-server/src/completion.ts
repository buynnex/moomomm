import { getNodeDefinition, resolveNodeContract, type NodeAst } from "@momom/core";
import { CompletionItemKind, type CompletionItem, type Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  getBooleanOutputs,
  getGraphContext,
  getKnownNodeTypes,
  getLinePrefix,
  getNodeTypeDescription,
  getOutputDescription,
} from "./utils.js";

const KEYWORDS = ["graph", "input", "node", "edge", "branch", "output", "true", "false"];
const NATIVE_TYPES = ["string", "number", "boolean", "unknown", "any", "void"];
const RISK_VALUES = ["low", "medium", "high", "critical"];
const COMMON_PROPERTIES = ["intent", "risk", "deterministic", "template", "topK"];

export function getCompletionItems(document: TextDocument, position: Position): CompletionItem[] {
  const items = new Map<string, CompletionItem>();
  const context = getGraphContext(document);
  const prefix = getLinePrefix(document, position);

  const addItem = (item: CompletionItem): void => {
    if (!items.has(item.label)) {
      items.set(item.label, item);
    }
  };

  const addLabels = (
    labels: string[],
    kind: CompletionItemKind,
    detail: string,
    documentation?: (label: string) => string | undefined,
  ): void => {
    for (const label of labels) {
      addItem({
        label,
        kind,
        detail,
        documentation: documentation?.(label),
      });
    }
  };

  const edgePortContext = matchContext(prefix, /\bedge\s+[A-Za-z_][A-Za-z0-9_.]*\s*->\s*([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z0-9_]*)?$/);
  if (edgePortContext) {
    addNodePortItems(addItem, findNode(context.nodes, edgePortContext.nodeId));
  }

  const outputContext = matchContext(
    prefix,
    /\boutput\s+[A-Za-z_][A-Za-z0-9_]*\s*:\s*([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z0-9_]*)?$/,
  );
  if (outputContext) {
    addNodeOutputItems(addItem, findNode(context.nodes, outputContext.nodeId));
  }

  const branchContext = matchContext(prefix, /\bbranch\s+([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z0-9_]*)?$/);
  if (branchContext) {
    addBranchOutputItems(addItem, findNode(context.nodes, branchContext.nodeId));
  }

  if (/^\s*input\s+[A-Za-z_][A-Za-z0-9_]*\s*:\s*[A-Za-z0-9_[\]]*$/.test(prefix)) {
    addLabels(NATIVE_TYPES, CompletionItemKind.TypeParameter, "Momom native type");
  }

  if (/^\s*node\s+[A-Za-z_][A-Za-z0-9_]*\s*:\s*[A-Za-z0-9_.]*$/.test(prefix)) {
    addLabels(getKnownNodeTypes(), CompletionItemKind.Class, "Known Momom node", getNodeTypeDescription);
  }

  if (/^\s*risk\s*:\s*["']?[A-Za-z]*$/.test(prefix)) {
    addLabels(RISK_VALUES, CompletionItemKind.EnumMember, "Momom risk value");
  }

  if (/^\s*deterministic\s*:\s*(?:true|false)?$/.test(prefix)) {
    addLabels(["true", "false"], CompletionItemKind.Value, "Boolean value");
  }

  addLabels(KEYWORDS, CompletionItemKind.Keyword, "Momom keyword");
  addLabels(NATIVE_TYPES, CompletionItemKind.TypeParameter, "Momom native type");
  addLabels(getKnownNodeTypes(), CompletionItemKind.Class, "Known Momom node", getNodeTypeDescription);
  addLabels(RISK_VALUES, CompletionItemKind.EnumMember, "Momom risk value");
  addLabels(COMMON_PROPERTIES, CompletionItemKind.Property, "Common Momom property");

  return [...items.values()];
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

  for (const [outputName] of Object.entries(getNodeDefinition(node.type)?.outputs ?? {})) {
    addItem({
      label: outputName,
      kind: CompletionItemKind.Property,
      detail: `Known output for ${node.type}`,
      documentation: getOutputDescription(node.type, outputName),
    });
  }
}

function addBranchOutputItems(addItem: (item: CompletionItem) => void, node: NodeAst | undefined): void {
  if (!node) {
    return;
  }

  for (const outputName of getBooleanOutputs(node.type)) {
    addItem({
      label: outputName,
      kind: CompletionItemKind.Operator,
      detail: `Boolean branch output for ${node.type}`,
      documentation: getOutputDescription(node.type, outputName),
    });
  }
}

function findNode(nodes: NodeAst[], nodeId: string): NodeAst | undefined {
  return nodes.find((node) => node.id === nodeId);
}

function matchContext(
  prefix: string,
  pattern: RegExp,
): { nodeId: string; partial: string } | undefined {
  const match = pattern.exec(prefix);
  if (!match) {
    return undefined;
  }

  return {
    nodeId: match[1],
    partial: match[2] ?? "",
  };
}
