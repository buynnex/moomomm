import type { BranchAst, GraphAst, OutputAst, SourceLocation } from "./ast.js";
import { DiagnosticCodes, createDiagnostic, type Diagnostic } from "./diagnostics.js";

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

    if (!inputs.has(edge.to) && !nodes.has(edge.to)) {
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
    validateBranch(branch, nodes, diagnostics);
  }

  for (const output of graph.outputs) {
    validateOutput(output, inputs, nodes, diagnostics);

    if (output.name.trim()) {
      registerId(output.name, output.loc);
    }
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics,
  };
}

function validateBranch(branch: BranchAst, nodes: Set<string>, diagnostics: Diagnostic[]): void {
  if (!branch.source.trim() || branch.cases.length === 0) {
    diagnostics.push(
      createDiagnostic(
        DiagnosticCodes.INVALID_BRANCH,
        "Branches precisam ter origem e pelo menos um caso.",
        "error",
        branch.loc,
      ),
    );
    return;
  }

  const [sourceNode] = splitReference(branch.source);
  if (!sourceNode || !nodes.has(sourceNode)) {
    diagnostics.push(
      createDiagnostic(
        DiagnosticCodes.MISSING_REFERENCE,
        `A referencia "${branch.source}" do branch nao existe.`,
        "error",
        branch.loc,
      ),
    );
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

function validateOutput(
  output: OutputAst,
  inputs: Set<string>,
  nodes: Set<string>,
  diagnostics: Diagnostic[],
): void {
  if (!output.name.trim() || !output.reference.trim()) {
    diagnostics.push(
      createDiagnostic(
        DiagnosticCodes.INVALID_OUTPUT,
        "Outputs precisam ter nome e referencia.",
        "error",
        output.loc,
      ),
    );
    return;
  }

  const [baseReference] = splitReference(output.reference);
  if (!baseReference || (!inputs.has(baseReference) && !nodes.has(baseReference))) {
    diagnostics.push(
      createDiagnostic(
        DiagnosticCodes.MISSING_REFERENCE,
        `A referencia "${output.reference}" do output nao existe.`,
        "error",
        output.loc,
      ),
    );
  }
}

function splitReference(reference: string): string[] {
  return reference
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
}
