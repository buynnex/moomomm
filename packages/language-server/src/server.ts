import {
  createConnection,
  ProposedFeatures,
  TextDocumentSyncKind,
  type InitializeResult,
} from "vscode-languageserver/node.js";
import { getCompletionItems } from "./completion.js";
import { getDefinition } from "./definition.js";
import { createDocumentManager } from "./documents.js";
import { getHover } from "./hover.js";
import { getReferences } from "./references.js";
import { getRenameWorkspaceEdit, prepareRename } from "./rename.js";
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
    definitionProvider: true,
    referencesProvider: true,
    renameProvider: {
      prepareProvider: true,
    },
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

connection.onDefinition((params) => {
  try {
    const document = documents.get(params.textDocument.uri);
    return document ? getDefinition(document, params.position) : undefined;
  } catch (error) {
    connection.console.error(formatServerError("definition", error));
    return undefined;
  }
});

connection.onReferences((params) => {
  try {
    const document = documents.get(params.textDocument.uri);
    return document ? getReferences(document, params.position, params.context.includeDeclaration) : [];
  } catch (error) {
    connection.console.error(formatServerError("references", error));
    return [];
  }
});

connection.onPrepareRename((params) => {
  try {
    const document = documents.get(params.textDocument.uri);
    return document ? prepareRename(document, params.position) : null;
  } catch (error) {
    connection.console.error(formatServerError("prepare rename", error));
    return null;
  }
});

connection.onRenameRequest((params) => {
  try {
    const document = documents.get(params.textDocument.uri);
    return document ? getRenameWorkspaceEdit(document, params.position, params.newName) : null;
  } catch (error) {
    connection.console.error(formatServerError("rename", error));
    throw error;
  }
});

documents.listen(connection);
connection.listen();

function formatServerError(operation: string, error: unknown): string {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  return `Momom language server ${operation} failed: ${message}`;
}
