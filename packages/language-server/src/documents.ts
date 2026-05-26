import type { Connection } from "vscode-languageserver";
import { TextDocuments } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { publishDocumentDiagnostics } from "./diagnostics.js";

export function createDocumentManager(connection: Connection): TextDocuments<TextDocument> {
  const documents = new TextDocuments(TextDocument);
  const timers = new Map<string, NodeJS.Timeout>();
  const debounceMs = 250;

  const clearTimer = (uri: string): void => {
    const existingTimer = timers.get(uri);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timers.delete(uri);
    }
  };

  const scheduleDiagnostics = (document: TextDocument): void => {
    clearTimer(document.uri);
    const timer = setTimeout(() => {
      timers.delete(document.uri);
      publishDocumentDiagnostics(connection, document);
    }, debounceMs);

    timers.set(document.uri, timer);
  };

  documents.onDidOpen((event) => {
    clearTimer(event.document.uri);
    publishDocumentDiagnostics(connection, event.document);
  });

  documents.onDidChangeContent((event) => {
    scheduleDiagnostics(event.document);
  });

  documents.onDidSave((event) => {
    clearTimer(event.document.uri);
    publishDocumentDiagnostics(connection, event.document);
  });

  documents.onDidClose((event) => {
    clearTimer(event.document.uri);
    connection.sendDiagnostics({
      uri: event.document.uri,
      diagnostics: [],
    });
  });

  return documents;
}
