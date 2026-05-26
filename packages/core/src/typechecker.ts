import type { Diagnostic } from "./diagnostics.js";
import { DiagnosticCodes, createDiagnostic } from "./diagnostics.js";
import { getNodeDefinition } from "./node-registry.js";
import { resolveReferenceType } from "./references.js";
import { areTypesCompatible, parseMomomType } from "./types.js";
import type { GraphAst, NodeAst } from "./ast.js";

const TEMPLATE_VARIABLE_PATTERN = /\{([^{}]+)\}/g;

export function typeCheckGraph(graph: GraphAst): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const inputByName = new Map(graph.inputs.map((input) => [input.name, input]));

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

    if (node.type === "ML.RecommendProducts") {
      diagnostics.push(...typeCheckRecommendNode(node, graph, inputByName));
    }

    if (node.type === "Auth.VerifyToken") {
      diagnostics.push(...typeCheckVerifyNode(node, graph, inputByName));
    }
  }

  for (const output of graph.outputs) {
    const resolution = resolveReferenceType({ reference: output.reference, graph });
    if (!resolution.ok) {
      diagnostics.push(
        createReferenceDiagnostic(
          resolution.code,
          output.reference,
          output.loc,
          resolution.reason === "missing-property"
            ? `A propriedade da referencia "${output.reference}" nao existe.`
            : resolution.message,
        ),
      );
    }
  }

  for (const branch of graph.branches) {
    const resolution = resolveReferenceType({ reference: branch.source, graph });
    if (!resolution.ok) {
      diagnostics.push(
        createReferenceDiagnostic(
          resolution.code,
          branch.source,
          branch.loc,
          resolution.reason === "missing-property"
            ? `A propriedade da referencia "${branch.source}" nao existe.`
            : resolution.message,
        ),
      );
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

  for (const edge of graph.edges) {
    if (!inputByName.has(edge.from) && !nodeById.has(edge.from)) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.MISSING_REFERENCE,
          `A referencia "${edge.from}" da edge nao existe.`,
          "error",
          edge.loc,
        ),
      );
    }

    if (!nodeById.has(edge.to)) {
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
          `A variavel de template "${variable}" possui tipo incompatível.`,
          "error",
          node.loc,
        ),
      );
    }
  }

  return diagnostics;
}

function typeCheckRecommendNode(
  node: NodeAst,
  graph: GraphAst,
  inputByName: Map<string, GraphAst["inputs"][number]>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const connectedInput = getConnectedInput(graph, node.id, "products", inputByName);
  if (!connectedInput) {
    return diagnostics;
  }

  const actualType = parseMomomType(connectedInput.type);
  const expectedType = parseMomomType("Product[]");
  if (!areTypesCompatible(actualType, expectedType)) {
    diagnostics.push(
      createDiagnostic(
        DiagnosticCodes.NODE_TYPE_MISMATCH,
        `O node "${node.id}" recebeu tipo incompatível para "products".`,
        "error",
        node.loc,
      ),
    );
  }

  return diagnostics;
}

function typeCheckVerifyNode(
  node: NodeAst,
  graph: GraphAst,
  inputByName: Map<string, GraphAst["inputs"][number]>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const connectedInput = getConnectedInput(graph, node.id, "token", inputByName);
  if (!connectedInput) {
    return diagnostics;
  }

  const rawType = parseMomomType(connectedInput.type).raw;
  if (!["Token", "string", "unknown"].includes(rawType)) {
    diagnostics.push(
      createDiagnostic(
        DiagnosticCodes.NODE_TYPE_MISMATCH,
        `O node "${node.id}" recebeu tipo incompatível para "token".`,
        "error",
        node.loc,
      ),
    );
  }

  return diagnostics;
}

function getConnectedInput(
  graph: GraphAst,
  nodeId: string,
  inputName: string,
  inputByName: Map<string, GraphAst["inputs"][number]>,
): GraphAst["inputs"][number] | undefined {
  const hasEdge = graph.edges.some((edge) => edge.to === nodeId && edge.from === inputName);
  if (!hasEdge) {
    return undefined;
  }

  return inputByName.get(inputName);
}

function extractTemplateVariables(template: string): string[] {
  const variables = new Set<string>();
  let match = TEMPLATE_VARIABLE_PATTERN.exec(template);

  while (match) {
    const variableName = match[1].trim();
    if (variableName) {
      variables.add(variableName);
    }
    match = TEMPLATE_VARIABLE_PATTERN.exec(template);
  }

  TEMPLATE_VARIABLE_PATTERN.lastIndex = 0;
  return [...variables];
}

function createReferenceDiagnostic(
  code: string,
  reference: string,
  loc: NodeAst["loc"] | undefined,
  fallbackMessage: string,
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

  return createDiagnostic(DiagnosticCodes.MISSING_REFERENCE, fallbackMessage, "error", loc);
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
