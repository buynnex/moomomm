import type { GraphAst, SourceLocation } from "./ast.js";
import { DiagnosticCodes, createDiagnostic, type Diagnostic } from "./diagnostics.js";
import { isRiskLevel } from "./node-registry.js";
import { typeCheckGraph } from "./typechecker.js";

export interface ValidationResult {
  valid: boolean;
  diagnostics: Diagnostic[];
}

export function validateGraph(graph: GraphAst): ValidationResult {
  const diagnostics: Diagnostic[] = [];
  const inputs = new Set<string>();
  const nodes = new Set<string>();
  const allIds = new Set<string>();

  if (!graph.name.trim()) {
    diagnostics.push(
      createDiagnostic(
        DiagnosticCodes.INVALID_GRAPH,
        "O grafo precisa ter um nome.",
        "error",
        graph.loc,
      ),
    );
  }

  const registerId = (id: string, loc: SourceLocation | undefined): void => {
    if (!id.trim()) {
      return;
    }

    if (allIds.has(id)) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.DUPLICATE_ID,
          `O id "${id}" esta duplicado.`,
          "error",
          loc,
        ),
      );
    }

    allIds.add(id);
  };

  for (const input of graph.inputs) {
    if (!input.name.trim() || !input.type.trim()) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.INVALID_INPUT,
          "Inputs precisam ter nome e tipo nao vazio.",
          "error",
          input.loc,
        ),
      );
      continue;
    }

    registerId(input.name, input.loc);
    inputs.add(input.name);
  }

  for (const node of graph.nodes) {
    if (!node.id.trim() || !node.type.trim()) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.INVALID_NODE,
          "Nodes precisam ter id e tipo nao vazio.",
          "error",
          node.loc,
        ),
      );
      continue;
    }

    registerId(node.id, node.loc);
    nodes.add(node.id);

    if (node.properties.risk !== undefined) {
      if (typeof node.properties.risk !== "string" || !isRiskLevel(node.properties.risk)) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.INVALID_RISK,
            `O node "${node.id}" possui um risk invalido.`,
            "error",
            node.loc,
          ),
        );
      }
    }

    if (node.properties.deterministic !== undefined && typeof node.properties.deterministic !== "boolean") {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.INVALID_DETERMINISTIC,
          `O node "${node.id}" precisa definir deterministic como boolean.`,
          "error",
          node.loc,
        ),
      );
    }

    if (node.properties.risk === "critical" && node.properties.deterministic === false) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.CRITICAL_NODE_PROBABILISTIC,
          `O node critico "${node.id}" nao pode ser probabilistico.`,
          "error",
          node.loc,
        ),
      );
    }
  }

  for (const edge of graph.edges) {
    if (!edge.from.trim() || !edge.to.trim()) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.INVALID_EDGE,
          "Edges precisam ter origem e destino.",
          "error",
          edge.loc,
        ),
      );
      continue;
    }

    if (!inputs.has(edge.from) && !nodes.has(edge.from)) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.MISSING_REFERENCE,
          `A referencia "${edge.from}" da edge nao existe.`,
          "error",
          edge.loc,
        ),
      );
    }

    if (!nodes.has(edge.to)) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.MISSING_REFERENCE,
          `A referencia "${edge.to}" da edge nao existe.`,
          "error",
          edge.loc,
        ),
      );
    }
  }

  for (const branch of graph.branches) {
    if (!branch.source.trim() || branch.cases.length === 0) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.INVALID_BRANCH,
          "Branches precisam ter origem e pelo menos um caso.",
          "error",
          branch.loc,
        ),
      );
      continue;
    }

    for (const branchCase of branch.cases) {
      if (!branchCase.value.trim() || !branchCase.target.trim()) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.INVALID_BRANCH,
            "Cada caso de branch precisa ter valor e target.",
            "error",
            branchCase.loc,
          ),
        );
        continue;
      }

      if (!nodes.has(branchCase.target)) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.MISSING_REFERENCE,
            `A referencia "${branchCase.target}" do branch nao existe.`,
            "error",
            branchCase.loc,
          ),
        );
      }
    }
  }

  for (const output of graph.outputs) {
    if (!output.name.trim() || !output.reference.trim()) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.INVALID_OUTPUT,
          "Outputs precisam ter nome e referencia.",
          "error",
          output.loc,
        ),
      );
      continue;
    }

    registerId(output.name, output.loc);
  }

  if (hasNodeCycle(graph, nodes)) {
    diagnostics.push(
      createDiagnostic(
        DiagnosticCodes.GRAPH_CYCLE,
        "Ciclo detectado no grafo.",
        "error",
        graph.loc,
      ),
    );
  }

  diagnostics.push(...typeCheckGraph(graph));

  return {
    valid: !diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    diagnostics: dedupeDiagnostics(diagnostics),
  };
}

function hasNodeCycle(graph: GraphAst, nodes: Set<string>): boolean {
  const adjacency = new Map<string, string[]>();

  for (const nodeId of nodes) {
    adjacency.set(nodeId, []);
  }

  for (const edge of graph.edges) {
    if (nodes.has(edge.from) && nodes.has(edge.to)) {
      adjacency.get(edge.from)?.push(edge.to);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) {
      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visiting.add(nodeId);
    for (const nextNodeId of adjacency.get(nodeId) ?? []) {
      if (visit(nextNodeId)) {
        return true;
      }
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };

  for (const nodeId of nodes) {
    if (visit(nodeId)) {
      return true;
    }
  }

  return false;
}

function dedupeDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();

  return diagnostics.filter((diagnostic) => {
    const key = [
      diagnostic.code,
      diagnostic.severity,
      diagnostic.message,
      diagnostic.loc?.file ?? "",
      diagnostic.loc?.line ?? "",
      diagnostic.loc?.column ?? "",
    ].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
