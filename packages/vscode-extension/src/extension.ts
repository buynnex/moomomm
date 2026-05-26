import * as vscode from "vscode";
import { registerMomomCommands } from "./commands.js";
import { MomomDiagnostics } from "./diagnostics.js";
import { MomomVirtualDocumentProvider } from "./preview.js";
import { isMomomDocument } from "./utils.js";

export function activate(context: vscode.ExtensionContext): void {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection("momom");
  const diagnostics = new MomomDiagnostics(diagnosticCollection);
  const previewProvider = new MomomVirtualDocumentProvider();

  context.subscriptions.push(
    diagnosticCollection,
    diagnostics,
    previewProvider,
    vscode.workspace.registerTextDocumentContentProvider("momom-preview", previewProvider),
  );

  registerMomomCommands(context, {
    diagnostics,
    previewProvider,
  });

  for (const document of vscode.workspace.textDocuments) {
    if (isMomomDocument(document)) {
      void diagnostics.validateDocument(document);
    }
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      if (isMomomDocument(document)) {
        void diagnostics.validateDocument(document);
      }
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      if (isMomomDocument(document)) {
        diagnostics.clearDocument(document);
      }
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (isMomomDocument(document)) {
        void diagnostics.validateDocument(document);
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.contentChanges.length === 0 || !isMomomDocument(event.document)) {
        return;
      }

      diagnostics.scheduleValidation(event.document, 350);
    }),
  );
}

export function deactivate(): void {}
