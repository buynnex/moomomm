import { getNodeDefinition } from "@momom/core";
import type { DocumentSymbol } from "vscode-languageserver";
import { SymbolKind } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { createLineRange, createWholeDocumentRange, findIdentifierRangeInLine, parseMomomDocument } from "./utils.js";

export function getDocumentSymbols(document: TextDocument): DocumentSymbol[] {
  const parsed = parseMomomDocument(document);
  if (!parsed.ok) {
    return [];
  }

  const { graph } = parsed;
  const graphLine = Math.max((graph.loc?.line ?? 1) - 1, 0);
  const graphSelectionRange =
    findIdentifierRangeInLine(document, graphLine, graph.name) ?? createLineRange(document, graphLine);

  const graphSymbol: DocumentSymbol = {
    name: `Graph ${graph.name}`,
    kind: SymbolKind.Namespace,
    range: createWholeDocumentRange(document),
    selectionRange: graphSelectionRange,
    children: [],
  };

  const inputsGroup: DocumentSymbol = {
    name: "Inputs",
    kind: SymbolKind.Module,
    range: createWholeDocumentRange(document),
    selectionRange: createLineRange(document, graphLine),
    children: [],
  };

  for (const input of graph.inputs) {
    const lineIndex = Math.max((input.loc?.line ?? 1) - 1, 0);
    inputsGroup.children?.push({
      name: `${input.name}: ${input.type}`,
      kind: SymbolKind.Variable,
      range: createLineRange(document, lineIndex),
      selectionRange: findIdentifierRangeInLine(document, lineIndex, input.name) ?? createLineRange(document, lineIndex),
    });
  }

  const nodesGroup: DocumentSymbol = {
    name: "Nodes",
    kind: SymbolKind.Module,
    range: createWholeDocumentRange(document),
    selectionRange: createLineRange(document, graphLine),
    children: [],
  };

  for (const node of graph.nodes) {
    const lineIndex = Math.max((node.loc?.line ?? 1) - 1, 0);
    const nodeSymbol: DocumentSymbol = {
      name: `${node.id}: ${node.type}`,
      kind: SymbolKind.Object,
      range: createLineRange(document, lineIndex),
      selectionRange: findIdentifierRangeInLine(document, lineIndex, node.id) ?? createLineRange(document, lineIndex),
      children: [],
    };

    for (const [outputName, outputType] of Object.entries(getNodeDefinition(node.type)?.outputs ?? {})) {
      nodeSymbol.children?.push({
        name: `${outputName}: ${outputType}`,
        kind: SymbolKind.Property,
        range: createLineRange(document, lineIndex),
        selectionRange: findIdentifierRangeInLine(document, lineIndex, node.id) ?? createLineRange(document, lineIndex),
      });
    }

    nodesGroup.children?.push(nodeSymbol);
  }

  const branchesGroup: DocumentSymbol = {
    name: "Branches",
    kind: SymbolKind.Module,
    range: createWholeDocumentRange(document),
    selectionRange: createLineRange(document, graphLine),
    children: [],
  };

  for (const branch of graph.branches) {
    const lineIndex = Math.max((branch.loc?.line ?? 1) - 1, 0);
    branchesGroup.children?.push({
      name: branch.source,
      kind: SymbolKind.Event,
      range: createLineRange(document, lineIndex),
      selectionRange:
        findIdentifierRangeInLine(document, lineIndex, branch.source) ?? createLineRange(document, lineIndex),
    });
  }

  const edgesGroup: DocumentSymbol = {
    name: "Edges",
    kind: SymbolKind.Module,
    range: createWholeDocumentRange(document),
    selectionRange: createLineRange(document, graphLine),
    children: [],
  };

  for (const edge of graph.edges) {
    const lineIndex = Math.max((edge.loc?.line ?? 1) - 1, 0);
    edgesGroup.children?.push({
      name: `${edge.from} -> ${edge.to}`,
      kind: SymbolKind.Operator,
      range: createLineRange(document, lineIndex),
      selectionRange: createLineRange(document, lineIndex),
    });
  }

  const outputsGroup: DocumentSymbol = {
    name: "Outputs",
    kind: SymbolKind.Module,
    range: createWholeDocumentRange(document),
    selectionRange: createLineRange(document, graphLine),
    children: [],
  };

  for (const output of graph.outputs) {
    const lineIndex = Math.max((output.loc?.line ?? 1) - 1, 0);
    outputsGroup.children?.push({
      name: `${output.name}: ${output.reference}`,
      kind: SymbolKind.Property,
      range: createLineRange(document, lineIndex),
      selectionRange:
        findIdentifierRangeInLine(document, lineIndex, output.name) ?? createLineRange(document, lineIndex),
    });
  }

  if ((inputsGroup.children?.length ?? 0) > 0) {
    graphSymbol.children?.push(inputsGroup);
  }

  if ((nodesGroup.children?.length ?? 0) > 0) {
    graphSymbol.children?.push(nodesGroup);
  }

  if ((branchesGroup.children?.length ?? 0) > 0) {
    graphSymbol.children?.push(branchesGroup);
  }

  if ((edgesGroup.children?.length ?? 0) > 0) {
    graphSymbol.children?.push(edgesGroup);
  }

  if ((outputsGroup.children?.length ?? 0) > 0) {
    graphSymbol.children?.push(outputsGroup);
  }

  return [graphSymbol];
}
