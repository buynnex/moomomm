import type { Location, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { createLocationFromRange, findIdentifierRangeInLine, findInputByName, findNodeById, parseMomomDocument } from "./utils.js";
import { getSymbolTargetAtPosition } from "./references.js";

export function getDefinition(document: TextDocument, position: Position): Location | undefined {
  const parsed = parseMomomDocument(document);
  if (!parsed.ok) {
    return undefined;
  }

  const target = getSymbolTargetAtPosition(document, position);
  if (!target || target.kind === "reference") {
    return undefined;
  }

  if (target.kind === "input") {
    const input = findInputByName(parsed.graph.inputs, target.name);
    if (!input?.loc) {
      return undefined;
    }

    const range = findIdentifierRangeInLine(document, Math.max(input.loc.line - 1, 0), target.name);
    return range ? createLocationFromRange(document.uri, range) : undefined;
  }

  const node = findNodeById(parsed.graph.nodes, target.name);
  if (!node?.loc) {
    return undefined;
  }

  const range = findIdentifierRangeInLine(document, Math.max(node.loc.line - 1, 0), target.name);
  return range ? createLocationFromRange(document.uri, range) : undefined;
}
