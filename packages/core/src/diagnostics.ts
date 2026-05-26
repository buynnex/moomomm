import type { SourceLocation } from "./ast.js";

export const DiagnosticCodes = {
  INVALID_GRAPH: "MOMOM001",
  INVALID_INPUT: "MOMOM002",
  INVALID_NODE: "MOMOM003",
  INVALID_EDGE: "MOMOM004",
  INVALID_BRANCH: "MOMOM005",
  INVALID_OUTPUT: "MOMOM006",
  CRITICAL_NODE_PROBABILISTIC: "MOMOM007",
  DUPLICATE_ID: "MOMOM008",
  MISSING_REFERENCE: "MOMOM009",
  GRAPH_CYCLE: "MOMOM010",
  INVALID_RISK: "MOMOM011",
  INVALID_DETERMINISTIC: "MOMOM012",
  INVALID_REFERENCE_PROPERTY: "MOMOM013",
  BRANCH_NOT_BOOLEAN: "MOMOM014",
  TEMPLATE_VARIABLE_MISSING: "MOMOM015",
  TEMPLATE_VARIABLE_INCOMPATIBLE: "MOMOM016",
  NODE_TYPE_MISMATCH: "MOMOM017",
  UNKNOWN_NODE: "MOMOM018",
  UNRESOLVED_TYPE: "MOMOM019",
} as const;

export type DiagnosticCode = (typeof DiagnosticCodes)[keyof typeof DiagnosticCodes];
export type DiagnosticSeverity = "error" | "warning";

export interface Diagnostic {
  code: DiagnosticCode;
  severity: DiagnosticSeverity;
  message: string;
  loc?: SourceLocation;
}

export function createDiagnostic(
  code: DiagnosticCode,
  message: string,
  severity: DiagnosticSeverity = "error",
  loc?: SourceLocation,
): Diagnostic {
  return {
    code,
    severity,
    message,
    loc,
  };
}

export function formatDiagnostic(diagnostic: Diagnostic): string {
  if (!diagnostic.loc) {
    return `[${diagnostic.code}] ${diagnostic.severity}: ${diagnostic.message}`;
  }

  const fileLabel = diagnostic.loc.file ?? "<memory>";
  return `[${diagnostic.code}] ${diagnostic.severity}: ${diagnostic.message} (${fileLabel}:${diagnostic.loc.line}:${diagnostic.loc.column})`;
}
