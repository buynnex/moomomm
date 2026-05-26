import {
  createConnection,
  ProposedFeatures,
  TextDocumentSyncKind,
  type InitializeResult,
} from "vscode-languageserver/node.js";
import { getCompletionItems } from "./completion.js";
import { createDocumentManager } from "./documents.js";
import { getHover } from "./hover.js";
import { getDocumentSymbols } from "./symbols.js";

const connection = createConnection(ProposedFeatures.all);
const documents = createDocumentManager(connection);

connection.onInitialize((): InitializeResult => ({
  capabilities: {
    textDocumentSync: {
      openClose: true,
      change: TextDocumentSyncKind.Incremental,
      save: {
        includeText: true,
      },
    },
    completionProvider: {
      triggerCharacters: [":", ".", " "],
    },
    hoverProvider: true,
    documentSymbolProvider: true,
  },
}));

connection.onCompletion((params) => {
  try {
    const document = documents.get(params.textDocument.uri);
    return document ? getCompletionItems(document, params.position) : [];
  } catch (error) {
    connection.console.error(formatServerError("completion", error));
    return [];
  }
});

connection.onHover((params) => {
  try {
    const document = documents.get(params.textDocument.uri);
    return document ? getHover(document, params.position) : undefined;
  } catch (error) {
    connection.console.error(formatServerError("hover", error));
    return undefined;
  }
});

connection.onDocumentSymbol((params) => {
  try {
    const document = documents.get(params.textDocument.uri);
    return document ? getDocumentSymbols(document) : [];
  } catch (error) {
    connection.console.error(formatServerError("document symbols", error));
    return [];
  }
});

documents.listen(connection);
connection.listen();

function formatServerError(operation: string, error: unknown): string {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  return `Momom language server ${operation} failed: ${message}`;
}
