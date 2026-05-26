import { validateGraph, type Diagnostic as MomomDiagnostic } from "@momom/core";
import type { Connection } from "vscode-languageserver";
import type { Diagnostic } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { parseMomomDocument, toLspDiagnostic } from "./utils.js";

export function collectMomomDiagnostics(document: TextDocument): MomomDiagnostic[] {
  const parsed = parseMomomDocument(document);
  if (!parsed.ok) {
    return parsed.diagnostics;
  }

  return validateGraph(parsed.graph).diagnostics;
}

export function getDocumentDiagnostics(document: TextDocument): Diagnostic[] {
  return collectMomomDiagnostics(document).map((diagnostic) => toLspDiagnostic(document, diagnostic));
}

export function publishDocumentDiagnostics(connection: Connection, document: TextDocument): void {
  connection.sendDiagnostics({
    uri: document.uri,
    diagnostics: getDocumentDiagnostics(document),
  });
}
