import type { GraphAst, NodeAst } from "./ast.js";
import { DiagnosticCodes, createDiagnostic, type Diagnostic } from "./diagnostics.js";
import { extractTemplateVariables, getNodeDefinition } from "./node-registry.js";
import { resolveReferenceType } from "./references.js";

export function typeCheckGraph(graph: GraphAst): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const node of graph.nodes) {
    const definition = getNodeDefinition(node.type);
    if (!definition) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.UNKNOWN_NODE,
          `O node "${node.id}" usa um tipo desconhecido na registry.`,
          "warning",
          node.loc,
        ),
      );
      continue;
    }

    if (node.type === "Text.Template") {
      diagnostics.push(...typeCheckTextTemplate(node, graph));
    }
  }

  for (const output of graph.outputs) {
    const resolution = resolveReferenceType({ reference: output.reference, graph });
    if (!resolution.ok) {
      diagnostics.push(createReferenceDiagnostic(resolution.code, output.reference, output.loc, resolution.message));
    }
  }

  for (const branch of graph.branches) {
    const resolution = resolveReferenceType({ reference: branch.source, graph });
    if (!resolution.ok) {
      diagnostics.push(createReferenceDiagnostic(resolution.code, branch.source, branch.loc, resolution.message));
      continue;
    }

    if (resolution.type.raw !== "boolean") {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.BRANCH_NOT_BOOLEAN,
          `O branch "${branch.source}" precisa usar uma expressao booleana.`,
          "error",
          branch.loc,
        ),
      );
    }
  }

  return dedupeDiagnostics(diagnostics);
}

function typeCheckTextTemplate(node: NodeAst, graph: GraphAst): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const template = typeof node.properties.template === "string" ? node.properties.template : "";
  const variables = extractTemplateVariables(template);

  for (const variable of variables) {
    const resolution = resolveReferenceType({ reference: variable, graph });
    if (!resolution.ok) {
      diagnostics.push(
        createDiagnostic(
          resolution.reason === "missing-property"
            ? DiagnosticCodes.INVALID_REFERENCE_PROPERTY
            : resolution.reason === "unresolved-type"
              ? DiagnosticCodes.UNRESOLVED_TYPE
              : DiagnosticCodes.TEMPLATE_VARIABLE_MISSING,
          resolution.reason === "missing-property"
            ? `A propriedade da referencia "${variable}" nao existe.`
            : resolution.reason === "unresolved-type"
              ? `Nao foi possivel resolver o tipo da variavel de template "${variable}".`
              : `A variavel de template "${variable}" nao existe.`,
          "error",
          node.loc,
        ),
      );
      continue;
    }

    if (!["string", "number", "boolean"].includes(resolution.type.raw)) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.TEMPLATE_VARIABLE_INCOMPATIBLE,
          `A variavel de template "${variable}" possui tipo incompativel.`,
          "error",
          node.loc,
        ),
      );
    }
  }

  return diagnostics;
}

function createReferenceDiagnostic(
  code: string,
  reference: string,
  loc: NodeAst["loc"] | undefined,
  message: string,
): Diagnostic {
  if (code === DiagnosticCodes.INVALID_REFERENCE_PROPERTY) {
    return createDiagnostic(
      DiagnosticCodes.INVALID_REFERENCE_PROPERTY,
      `A propriedade inexistente na referencia "${reference}".`,
      "error",
      loc,
    );
  }

  if (code === DiagnosticCodes.UNRESOLVED_TYPE) {
    return createDiagnostic(
      DiagnosticCodes.UNRESOLVED_TYPE,
      `Nao foi possivel resolver o tipo da referencia "${reference}".`,
      "error",
      loc,
    );
  }

  return createDiagnostic(DiagnosticCodes.MISSING_REFERENCE, message, "error", loc);
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
