import type { DocumentSymbol } from "vscode-languageserver";
import { SymbolKind } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  createLineRange,
  createWholeDocumentRange,
  findIdentifierRangeInLine,
  parseMomomDocument,
} from "./utils.js";

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
    kind: SymbolKind.Class,
    range: createWholeDocumentRange(document),
    selectionRange: graphSelectionRange,
    children: [],
  };

  for (const input of graph.inputs) {
    const lineIndex = Math.max((input.loc?.line ?? 1) - 1, 0);
    graphSymbol.children?.push({
      name: `input ${input.name}: ${input.type}`,
      kind: SymbolKind.Variable,
      range: createLineRange(document, lineIndex),
      selectionRange: findIdentifierRangeInLine(document, lineIndex, input.name) ?? createLineRange(document, lineIndex),
    });
  }

  for (const node of graph.nodes) {
    const lineIndex = Math.max((node.loc?.line ?? 1) - 1, 0);
    graphSymbol.children?.push({
      name: `node ${node.id}: ${node.type}`,
      kind: SymbolKind.Object,
      range: createLineRange(document, lineIndex),
      selectionRange: findIdentifierRangeInLine(document, lineIndex, node.id) ?? createLineRange(document, lineIndex),
    });
  }

  for (const branch of graph.branches) {
    const lineIndex = Math.max((branch.loc?.line ?? 1) - 1, 0);
    graphSymbol.children?.push({
      name: `branch ${branch.source}`,
      kind: SymbolKind.Event,
      range: createLineRange(document, lineIndex),
      selectionRange:
        findIdentifierRangeInLine(document, lineIndex, branch.source) ?? createLineRange(document, lineIndex),
    });
  }

  for (const output of graph.outputs) {
    const lineIndex = Math.max((output.loc?.line ?? 1) - 1, 0);
    graphSymbol.children?.push({
      name: `output ${output.name}: ${output.reference}`,
      kind: SymbolKind.Property,
      range: createLineRange(document, lineIndex),
      selectionRange:
        findIdentifierRangeInLine(document, lineIndex, output.name) ?? createLineRange(document, lineIndex),
    });
  }

  return [graphSymbol];
}
