import path from "node:path";
import * as vscode from "vscode";
import {
  createDiagnostic,
  DiagnosticCodes,
  ParserError,
  parseGraph,
  type Diagnostic as MomomDiagnostic,
  type GraphAst,
} from "@momom/core";

export type ParsedMomomDocument =
  | {
      ok: true;
      graph: GraphAst;
    }
  | {
      ok: false;
      diagnostics: MomomDiagnostic[];
    };

export function isMomomDocument(document: vscode.TextDocument): boolean {
  return document.languageId === "momom" || document.uri.path.toLowerCase().endsWith(".momom");
}

export function getDocumentText(document: vscode.TextDocument): string {
  return document.getText();
}

export function parseMomomDocument(document: vscode.TextDocument): ParsedMomomDocument {
  try {
    return {
      ok: true,
      graph: parseGraph(getDocumentText(document), {
        file: document.uri.fsPath || document.fileName || document.uri.toString(),
      }),
    };
  } catch (error) {
    if (error instanceof ParserError) {
      return {
        ok: false,
        diagnostics: [
          createDiagnostic(
            DiagnosticCodes.INVALID_GRAPH,
            error.message,
            "error",
            {
              file: document.uri.fsPath || document.fileName || document.uri.toString(),
              line: error.line,
              column: error.column,
            },
          ),
        ],
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      diagnostics: [
        createDiagnostic(
          DiagnosticCodes.INVALID_GRAPH,
          message,
          "error",
          {
            file: document.uri.fsPath || document.fileName || document.uri.toString(),
            line: 1,
            column: 1,
          },
        ),
      ],
    };
  }
}

export function diagnosticToVSCodeDiagnostic(
  diagnostic: MomomDiagnostic,
  document: vscode.TextDocument,
): vscode.Diagnostic {
  const lineCount = Math.max(document.lineCount, 1);
  const lineIndex = Math.min(Math.max((diagnostic.loc?.line ?? 1) - 1, 0), lineCount - 1);
  const lineText = document.lineAt(lineIndex).text;
  const columnIndex = Math.min(Math.max((diagnostic.loc?.column ?? 1) - 1, 0), lineText.length);
  const endColumnIndex = Math.min(columnIndex + 1, lineText.length);
  const range = new vscode.Range(
    new vscode.Position(lineIndex, columnIndex),
    new vscode.Position(lineIndex, endColumnIndex),
  );

  return new vscode.Diagnostic(
    range,
    `[${diagnostic.code}] ${diagnostic.message}`,
    toVSCodeSeverity(diagnostic.severity),
  );
}

export function getGeneratedFileName(document: vscode.TextDocument): string {
  const extension = path.extname(document.fileName);
  const baseName = path.basename(document.fileName, extension || undefined);
  return `${baseName || "momom"}.generated.ts`;
}

export function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return JSON.stringify(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    );
  }
}

function toVSCodeSeverity(severity: string): vscode.DiagnosticSeverity {
  if (severity === "warning") {
    return vscode.DiagnosticSeverity.Warning;
  }

  if (severity === "info") {
    return vscode.DiagnosticSeverity.Information;
  }

  return vscode.DiagnosticSeverity.Error;
}
