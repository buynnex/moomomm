import * as vscode from "vscode";
import type { GraphAst, GraphIR, GraphFlowAnalysis } from "@momom/core";
import { safeJsonStringify } from "./utils.js";

export class MomomVirtualDocumentProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {
  private readonly contentByUri = new Map<string, string>();
  private readonly onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();

  readonly onDidChange = this.onDidChangeEmitter.event;

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contentByUri.get(uri.toString()) ?? "";
  }

  setContent(uri: vscode.Uri, content: string): void {
    this.contentByUri.set(uri.toString(), content);
    this.onDidChangeEmitter.fire(uri);
  }

  dispose(): void {
    this.contentByUri.clear();
    this.onDidChangeEmitter.dispose();
  }
}

export async function openVirtualJsonDocument(
  provider: MomomVirtualDocumentProvider,
  title: string,
  value: unknown,
): Promise<void> {
  const uri = vscode.Uri.parse(`momom-preview:/${slugify(title)}.json`);
  provider.setContent(uri, safeJsonStringify(value));

  const document = await vscode.workspace.openTextDocument(uri);
  const jsonDocument = await vscode.languages.setTextDocumentLanguage(document, "json");
  await vscode.window.showTextDocument(jsonDocument, {
    preview: false,
    viewColumn: vscode.ViewColumn.Beside,
  });
}

export function buildGraphPreviewHtml(params: {
  documentTitle: string;
  graph: GraphAst;
  ir: GraphIR;
  flow: GraphFlowAnalysis;
  mermaid: string;
}): string {
  const nodesMarkup = params.ir.nodes
    .map((node) =>
      [
        "<li>",
        `<strong>${escapeHtml(node.id)}</strong>`,
        ` <code>${escapeHtml(node.type)}</code>`,
        node.risk ? ` <span>risk: ${escapeHtml(node.risk)}</span>` : "",
        typeof node.deterministic === "boolean"
          ? ` <span>deterministic: ${escapeHtml(String(node.deterministic))}</span>`
          : "",
        Object.keys(node.outputs).length > 0
          ? `<div class="meta">outputs: ${escapeHtml(safeJsonStringify(node.outputs))}</div>`
          : "",
        "</li>",
      ].join(""),
    )
    .join("");

  const edgesMarkup = params.ir.edges
    .map((edge) => {
      const portLabel = edge.toPort ? `.${edge.toPort}` : "";
      const typeLabel = edge.fromType ? ` (${edge.fromType})` : "";
      return `<li><code>${escapeHtml(edge.from)}</code>${escapeHtml(typeLabel)} -> <code>${escapeHtml(
        `${edge.toNode ?? edge.to}${portLabel}`,
      )}</code></li>`;
    })
    .join("");

  const branchesMarkup = params.ir.branches
    .map(
      (branch) =>
        `<li><code>${escapeHtml(branch.source)}</code>: ${escapeHtml(
          branch.cases.map((branchCase) => `${branchCase.value} -> ${branchCase.target}`).join(", "),
        )}</li>`,
    )
    .join("");

  const outputsMarkup = params.ir.outputs
    .map(
      (output) =>
        `<li><strong>${escapeHtml(output.name)}</strong>: <code>${escapeHtml(output.reference)}</code>${
          output.type ? ` <span>${escapeHtml(output.type)}</span>` : ""
        }</li>`,
    )
    .join("");

  const executionMarkup = params.flow.executionPlan
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.nodeId)}</strong> order=${item.order} dependsOn=${escapeHtml(
          item.dependsOn.join(", ") || "-",
        )}</li>`,
    )
    .join("");

  const inputsMarkup = params.graph.inputs
    .map((input) => `<li><strong>${escapeHtml(input.name)}</strong>: ${escapeHtml(input.type)}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Momom Graph Preview</title>
    <style>
      body {
        font-family: Consolas, "Courier New", monospace;
        margin: 0;
        padding: 24px;
        color: #f3f4f6;
        background: linear-gradient(180deg, #111827 0%, #0f172a 100%);
      }
      h1, h2 {
        margin: 0 0 12px;
      }
      h1 {
        font-size: 24px;
      }
      h2 {
        font-size: 16px;
        margin-top: 24px;
      }
      .subtle {
        color: #cbd5e1;
        margin: 4px 0 16px;
      }
      .card {
        border: 1px solid #334155;
        border-radius: 10px;
        padding: 16px;
        background: rgba(15, 23, 42, 0.75);
        margin-top: 16px;
      }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
        background: #020617;
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 12px;
        overflow-x: auto;
      }
      ul {
        padding-left: 20px;
      }
      li {
        margin: 6px 0;
      }
      code {
        color: #facc15;
      }
      .meta {
        color: #cbd5e1;
        margin-top: 6px;
      }
    </style>
  </head>
  <body>
    <h1>Momom Graph Preview</h1>
    <div class="subtle">Graph: ${escapeHtml(params.graph.name)} (${escapeHtml(params.documentTitle)})</div>

    <section class="card">
      <h2>Mermaid</h2>
      <div class="subtle">Offline preview source. Copy directly from the block below.</div>
      <pre>${escapeHtml(params.mermaid)}</pre>
    </section>

    <section class="card">
      <h2>Inputs</h2>
      <ul>${inputsMarkup || "<li>No inputs.</li>"}</ul>
    </section>

    <section class="card">
      <h2>Nodes</h2>
      <ul>${nodesMarkup || "<li>No nodes.</li>"}</ul>
    </section>

    <section class="card">
      <h2>Edges</h2>
      <ul>${edgesMarkup || "<li>No edges.</li>"}</ul>
    </section>

    <section class="card">
      <h2>Branches</h2>
      <ul>${branchesMarkup || "<li>No branches.</li>"}</ul>
    </section>

    <section class="card">
      <h2>Outputs</h2>
      <ul>${outputsMarkup || "<li>No outputs.</li>"}</ul>
    </section>

    <section class="card">
      <h2>Execution Plan</h2>
      <ul>${executionMarkup || "<li>No execution plan.</li>"}</ul>
    </section>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]/g, "-");
}
