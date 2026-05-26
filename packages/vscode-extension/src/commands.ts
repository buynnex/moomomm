import path from "node:path";
import * as vscode from "vscode";
import {
  analyzeGraphFlow,
  buildIR,
  compileGraphToTypeScript,
  CompilerDiagnosticError,
  graphToMermaid,
} from "@momom/core";
import type { Diagnostic as MomomDiagnostic } from "@momom/core";
import { MomomDiagnostics } from "./diagnostics.js";
import { buildGraphPreviewHtml, MomomVirtualDocumentProvider, openVirtualJsonDocument } from "./preview.js";
import { getActiveOrVisibleMomomDocument, getGeneratedFileName, parseMomomDocument } from "./utils.js";

export interface CommandDependencies {
  diagnostics: MomomDiagnostics;
  previewProvider: MomomVirtualDocumentProvider;
}

export function registerMomomCommands(
  context: vscode.ExtensionContext,
  dependencies: CommandDependencies,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("momom.validateCurrentFile", async () => {
      const document = getActiveMomomDocument();
      if (!document) {
        return;
      }

      const summary = await dependencies.diagnostics.validateDocument(document);
      showValidationMessage(summary.errorCount, summary.warningCount);
    }),
    vscode.commands.registerCommand("momom.showIR", async () => {
      const document = getActiveMomomDocument();
      if (!document) {
        return;
      }

      const parsed = parseMomomDocument(document);
      if (!parsed.ok) {
        applyDiagnosticsAndNotify(dependencies.diagnostics, document, parsed.diagnostics, "Momom: unable to build IR.");
        return;
      }

      await openVirtualJsonDocument(
        dependencies.previewProvider,
        `${path.basename(document.fileName)}-ir`,
        buildIR(parsed.graph),
      );
    }),
    vscode.commands.registerCommand("momom.showFlow", async () => {
      const document = getActiveMomomDocument();
      if (!document) {
        return;
      }

      const parsed = parseMomomDocument(document);
      if (!parsed.ok) {
        applyDiagnosticsAndNotify(
          dependencies.diagnostics,
          document,
          parsed.diagnostics,
          "Momom: unable to analyze flow.",
        );
        return;
      }

      await openVirtualJsonDocument(
        dependencies.previewProvider,
        `${path.basename(document.fileName)}-flow`,
        analyzeGraphFlow(parsed.graph),
      );
    }),
    vscode.commands.registerCommand("momom.previewGraph", async () => {
      const document = getActiveMomomDocument();
      if (!document) {
        return;
      }

      const parsed = parseMomomDocument(document);
      if (!parsed.ok) {
        applyDiagnosticsAndNotify(
          dependencies.diagnostics,
          document,
          parsed.diagnostics,
          "Momom: unable to preview the graph.",
        );
        return;
      }

      const ir = buildIR(parsed.graph);
      const flow = analyzeGraphFlow(parsed.graph);
      const panel = vscode.window.createWebviewPanel(
        "momomGraphPreview",
        "Momom Graph Preview",
        vscode.ViewColumn.Beside,
        {
          enableScripts: false,
        },
      );

      panel.webview.html = buildGraphPreviewHtml({
        documentTitle: path.basename(document.fileName),
        graph: parsed.graph,
        ir,
        flow,
        mermaid: graphToMermaid(parsed.graph),
      });
    }),
    vscode.commands.registerCommand("momom.compileCurrentFile", async () => {
      const document = getActiveMomomDocument();
      if (!document) {
        return;
      }

      const parsed = parseMomomDocument(document);
      if (!parsed.ok) {
        applyDiagnosticsAndNotify(
          dependencies.diagnostics,
          document,
          parsed.diagnostics,
          "Momom: compilation failed because the current file could not be parsed.",
        );
        return;
      }

      const summary = await dependencies.diagnostics.validateDocument(document);
      if (!summary.success) {
        showValidationMessage(summary.errorCount, summary.warningCount);
        return;
      }

      try {
        const output = compileGraphToTypeScript(parsed.graph);
        const targetUri = await vscode.window.showSaveDialog({
          saveLabel: "Save TypeScript Output",
          defaultUri: getSuggestedOutputUri(document),
          filters: {
            TypeScript: ["ts"],
          },
        });

        if (!targetUri) {
          return;
        }

        await vscode.workspace.fs.writeFile(targetUri, Buffer.from(output, "utf8"));
        vscode.window.showInformationMessage(`Momom: compiled successfully to ${targetUri.fsPath || targetUri.path}`);
      } catch (error) {
        if (error instanceof CompilerDiagnosticError) {
          const compilerSummary = dependencies.diagnostics.applyMomomDiagnostics(document, error.diagnostics);
          showValidationMessage(compilerSummary.errorCount, compilerSummary.warningCount);
          return;
        }

        throw error;
      }
    }),
  );
}

function getActiveMomomDocument(): vscode.TextDocument | undefined {
  const document = getActiveOrVisibleMomomDocument();
  if (!document) {
    void vscode.window.showWarningMessage("Momom: open a .momom file first.");
    return undefined;
  }

  return document;
}

function getSuggestedOutputUri(document: vscode.TextDocument): vscode.Uri | undefined {
  if (document.uri.scheme !== "file") {
    return undefined;
  }

  return vscode.Uri.file(path.join(path.dirname(document.fileName), getGeneratedFileName(document)));
}

function applyDiagnosticsAndNotify(
  diagnostics: MomomDiagnostics,
  document: vscode.TextDocument,
  momomDiagnostics: MomomDiagnostic[],
  fallbackMessage: string,
): void {
  diagnostics.applyMomomDiagnostics(document, momomDiagnostics);
  const message = momomDiagnostics[0]?.message ?? fallbackMessage;
  void vscode.window.showErrorMessage(message.startsWith("Momom:") ? message : fallbackMessage);
}

function showValidationMessage(errorCount: number, warningCount: number): void {
  if (errorCount > 0) {
    void vscode.window.showErrorMessage(`Momom: validation failed with ${errorCount} error(s).`);
    return;
  }

  if (warningCount > 0) {
    void vscode.window.showWarningMessage("Momom: validation succeeded with warnings.");
    return;
  }

  void vscode.window.showInformationMessage("Momom: validation succeeded.");
}
