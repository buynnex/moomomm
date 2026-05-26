import { ErrorCodes, ResponseError, type Position, type PrepareRenameResult, type WorkspaceEdit } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { collectReferencesForTarget, getSymbolTargetAtPosition } from "./references.js";

const VALID_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function prepareRename(document: TextDocument, position: Position): PrepareRenameResult | null {
  const target = getSymbolTargetAtPosition(document, position);
  if (!target || target.kind === "reference") {
    return null;
  }

  return {
    range: target.range,
    placeholder: target.name,
  };
}

export function getRenameWorkspaceEdit(
  document: TextDocument,
  position: Position,
  newName: string,
): WorkspaceEdit | null {
  if (!VALID_NAME_PATTERN.test(newName)) {
    throw new ResponseError(
      ErrorCodes.InvalidParams,
      "Momom rename requires identifiers that match ^[A-Za-z_][A-Za-z0-9_]*$.",
    );
  }

  const target = getSymbolTargetAtPosition(document, position);
  if (!target || target.kind === "reference") {
    return null;
  }

  const references = collectReferencesForTarget(document, target, true);
  return {
    changes: {
      [document.uri]: references.map((reference) => ({
        range: reference.range,
        newText: newName,
      })),
    },
  };
}
