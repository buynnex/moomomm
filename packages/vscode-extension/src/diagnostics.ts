import * as vscode from "vscode";
import { validateGraph, type Diagnostic as MomomDiagnostic } from "@momom/core";
import { diagnosticToVSCodeDiagnostic, isMomomDocument, parseMomomDocument } from "./utils.js";

export interface ValidationSummary {
  success: boolean;
  errorCount: number;
  warningCount: number;
  diagnostics: MomomDiagnostic[];
}

export class MomomDiagnostics implements vscode.Disposable {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly collection: vscode.DiagnosticCollection) {}

  async validateDocument(document: vscode.TextDocument): Promise<ValidationSummary> {
    if (!isMomomDocument(document)) {
      this.clearDocument(document);
      return {
        success: true,
        errorCount: 0,
        warningCount: 0,
        diagnostics: [],
      };
    }

    const parsed = parseMomomDocument(document);
    if (!parsed.ok) {
      return this.applyMomomDiagnostics(document, parsed.diagnostics);
    }

    return this.applyMomomDiagnostics(document, validateGraph(parsed.graph).diagnostics);
  }

  scheduleValidation(document: vscode.TextDocument, delay = 350): void {
    const timerKey = document.uri.toString();
    const existingTimer = this.timers.get(timerKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.timers.delete(timerKey);
      void this.validateDocument(document);
    }, delay);

    this.timers.set(timerKey, timer);
  }

  applyMomomDiagnostics(document: vscode.TextDocument, diagnostics: MomomDiagnostic[]): ValidationSummary {
    this.collection.set(
      document.uri,
      diagnostics.map((diagnostic) => diagnosticToVSCodeDiagnostic(diagnostic, document)),
    );

    const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
    const warningCount = diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;

    return {
      success: errorCount === 0,
      errorCount,
      warningCount,
      diagnostics,
    };
  }

  clearDocument(document: vscode.TextDocument): void {
    const timerKey = document.uri.toString();
    const existingTimer = this.timers.get(timerKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.timers.delete(timerKey);
    }

    this.collection.delete(document.uri);
  }

  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }

    this.timers.clear();
    this.collection.clear();
    this.collection.dispose();
  }
}
