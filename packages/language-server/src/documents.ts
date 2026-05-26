import type { Connection } from "vscode-languageserver";
import { TextDocuments } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { publishDocumentDiagnostics } from "./diagnostics.js";

export function createDocumentManager(connection: Connection): TextDocuments<TextDocument> {
  const documents = new TextDocuments(TextDocument);

  documents.onDidOpen((event) => {
    publishDocumentDiagnostics(connection, event.document);
  });

  documents.onDidChangeContent((event) => {
    publishDocumentDiagnostics(connection, event.document);
  });

  documents.onDidSave((event) => {
    publishDocumentDiagnostics(connection, event.document);
  });

  documents.onDidClose((event) => {
    connection.sendDiagnostics({
      uri: event.document.uri,
      diagnostics: [],
    });
  });

  return documents;
}
