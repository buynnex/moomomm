import type { GraphAst } from "./ast.js";
import { type Diagnostic } from "./diagnostics.js";
import type { GraphIR, IRNode, IROutput } from "./ir.js";
import { buildIR } from "./ir.js";
import { getNodeDefinition, getNodeOutputType } from "./node-registry.js";
import { validateGraph } from "./validator.js";

export class CompilerDiagnosticError extends Error {
  constructor(readonly diagnostics: Diagnostic[]) {
    super("Compilation failed due to diagnostics.");
    this.name = "CompilerDiagnosticError";
  }
}

export function compileGraphToTypeScript(graph: GraphAst): string {
  const validation = validateGraph(graph);
  if (!validation.valid) {
    throw new CompilerDiagnosticError(validation.diagnostics.filter((diagnostic) => diagnostic.severity === "error"));
  }

  return compileToTypeScript(buildIR(graph));
}

export function compileToTypeScript(ir: GraphIR): string {
  const graphName = toIdentifier(ir.name, "Graph");
  const inputTypeName = `${graphName}Input`;
  const outputTypeName = `${graphName}Output`;
  const inputNames = new Set(ir.inputs.map((input) => input.name));
  const nodeVariables = new Map(ir.nodes.map((node) => [node.id, toIdentifier(node.id, "node")]));
  const referencedNodeProperties = collectReferencedNodeProperties(ir);
  const customTypes = collectCustomTypes(ir);

  const body: string[] = [];

  for (const node of ir.nodes) {
    body.push(
      ...compileNode(
        node,
        inputNames,
        nodeVariables,
        referencedNodeProperties.get(node.id) ?? new Set<string>(),
      ),
    );
  }

  for (const branch of ir.branches) {
    body.push(`  // TODO: Implement deterministic branch routing for ${branch.source}.`);
  }

  body.push(...compileReturnBlock(ir.outputs, inputNames, nodeVariables));

  const sections: string[] = [];

  if (customTypes.length > 0) {
    sections.push(...customTypes.map((typeName) => `export type ${typeName} = unknown;`), "");
  }

  sections.push(
    renderTypeAlias(
      inputTypeName,
      ir.inputs.map((input) => ({
        key: input.name,
        type: toTypeAnnotation(input.type),
      })),
    ),
    "",
    renderTypeAlias(
      outputTypeName,
      ir.outputs.map((output) => ({
        key: output.name,
        type: output.type ?? inferReferenceType(ir, output.reference),
      })),
    ),
    "",
    `export function ${graphName}(input: ${inputTypeName}): ${outputTypeName} {`,
    ...body,
    "}",
    "",
  );

  return sections.join("\n");
}

function renderTypeAlias(name: string, fields: Array<{ key: string; type: string }>): string {
  if (fields.length === 0) {
    return `export type ${name} = Record<string, never>;`;
  }

  return [
    `export type ${name} = {`,
    ...fields.map((field) => `  ${formatObjectKey(field.key)}: ${field.type};`),
    "};",
  ].join("\n");
}

function compileNode(
  node: IRNode,
  inputNames: Set<string>,
  nodeVariables: Map<string, string>,
  referencedProperties: Set<string>,
): string[] {
  const variableName = nodeVariables.get(node.id) ?? toIdentifier(node.id, "node");
  const nodeDefinition = getNodeDefinition(node.type);

  if (nodeDefinition) {
    switch (nodeDefinition.compileStrategy) {
      case "template": {
        const template = typeof node.properties.template === "string" ? node.properties.template : "";
        return [
          `  const ${variableName} = {`,
          `    text: ${renderTemplateLiteral(template, inputNames, nodeVariables)},`,
          "  };",
          "",
        ];
      }
      case "placeholder-auth":
        return [
          "  // TODO: Auth.VerifyToken placeholder seguro. Substituir por autenticacao real.",
          `  const ${variableName} = {`,
          `    valid: ${inputNames.has("token") ? "Boolean(input.token)" : "false"},`,
          "  };",
          "",
        ];
      case "placeholder-recommend": {
        const topK = typeof node.properties.topK === "number" ? node.properties.topK : 10;
        const itemsExpression = inputNames.has("products")
          ? `input.products.slice(0, ${topK})`
          : `[] as ${getNodeOutputType(node.type, "items") ?? "unknown[]"}`;
        return [
          "  // TODO: ML.RecommendProducts placeholder seguro. Substituir por recomendacao real.",
          `  const ${variableName} = {`,
          `    items: ${itemsExpression},`,
          "  };",
          "",
        ];
      }
      case "placeholder-action":
        return [
          "  // TODO: Action.TriggerAnomaly placeholder seguro.",
          `  const ${variableName} = {`,
          "    triggered: true,",
          "  };",
          "",
        ];
    }
  }

  const properties = [...referencedProperties].sort();
  const lines = [`  // TODO: Implement node ${node.id} of type ${node.type}.`];

  if (properties.length === 0) {
    lines.push(`  const ${variableName} = {};`, "");
    return lines;
  }

  lines.push(`  const ${variableName} = {`);
  for (const property of properties) {
    lines.push(`    ${formatObjectKey(property)}: undefined as unknown,`);
  }
  lines.push("  };", "");
  return lines;
}

function compileReturnBlock(
  outputs: IROutput[],
  inputNames: Set<string>,
  nodeVariables: Map<string, string>,
): string[] {
  if (outputs.length === 0) {
    return ["  return {};"];
  }

  return [
    "  return {",
    ...outputs.map(
      (output) =>
        `    ${formatObjectKey(output.name)}: ${compileReference(output.reference, inputNames, nodeVariables)},`,
    ),
    "  };",
  ];
}

function inferReferenceType(ir: GraphIR, reference: string): string {
  const parts = splitReference(reference);
  if (parts.length === 0) {
    return "unknown";
  }

  const [base, property] = parts;
  const input = ir.inputs.find((item) => item.name === base);
  if (input) {
    return parts.length === 1 ? toTypeAnnotation(input.type) : "unknown";
  }

  const node = ir.nodes.find((item) => item.id === base);
  if (!node) {
    return "unknown";
  }

  const nodeDefinition = getNodeDefinition(node.type);
  if (property && node.outputs[property]) {
    return node.outputs[property];
  }

  if (!property) {
    const outputTypes = Object.values(node.outputs);
    if (outputTypes.length === 1) {
      return outputTypes[0];
    }
  }

  return "unknown";
}

function compileReference(
  reference: string,
  inputNames: Set<string>,
  nodeVariables: Map<string, string>,
): string {
  const parts = splitReference(reference);
  if (parts.length === 0) {
    return "undefined";
  }

  const [base, ...rest] = parts;
  if (inputNames.has(base)) {
    return compileAccess("input", parts);
  }

  const variableName = nodeVariables.get(base) ?? toIdentifier(base, "value");
  return compileAccess(variableName, rest);
}

function collectReferencedNodeProperties(ir: GraphIR): Map<string, Set<string>> {
  const nodeIds = new Set(ir.nodes.map((node) => node.id));
  const references = new Map<string, Set<string>>();

  const addReference = (reference: string): void => {
    const [base, property] = splitReference(reference);
    if (!base || !property || !nodeIds.has(base)) {
      return;
    }

    const properties = references.get(base) ?? new Set<string>();
    properties.add(property);
    references.set(base, properties);
  };

  for (const output of ir.outputs) {
    addReference(output.reference);
  }

  for (const branch of ir.branches) {
    addReference(branch.source);
  }

  return references;
}

function collectCustomTypes(ir: GraphIR): string[] {
  const customTypes: string[] = [];
  const seenTypes = new Set<string>();

  const registerType = (typeAnnotation: string): void => {
    for (const customType of extractCustomTypes(typeAnnotation)) {
      if (!seenTypes.has(customType)) {
        seenTypes.add(customType);
        customTypes.push(customType);
      }
    }
  };

  for (const input of ir.inputs) {
    registerType(input.type);
  }

  for (const output of ir.outputs) {
    registerType(output.type ?? inferReferenceType(ir, output.reference));
  }

  for (const node of ir.nodes) {
    for (const outputType of Object.values(node.outputs)) {
      registerType(outputType);
    }
  }

  return customTypes;
}

function renderTemplateLiteral(
  template: string,
  inputNames: Set<string>,
  nodeVariables: Map<string, string>,
): string {
  const pattern = /\{([^{}]+)\}/g;
  let result = "";
  let lastIndex = 0;
  let match = pattern.exec(template);

  while (match) {
    const [rawMatch, name] = match;
    const start = match.index;
    result += escapeTemplateChunk(template.slice(lastIndex, start));

    const trimmedName = name.trim();
    const compiledReference = compileResolvedTemplateReference(trimmedName, inputNames, nodeVariables);
    if (compiledReference) {
      result += `\${${compiledReference}}`;
    } else {
      result += escapeTemplateChunk(rawMatch);
    }

    lastIndex = start + rawMatch.length;
    match = pattern.exec(template);
  }

  result += escapeTemplateChunk(template.slice(lastIndex));
  return `\`${result}\``;
}

function compileResolvedTemplateReference(
  reference: string,
  inputNames: Set<string>,
  nodeVariables: Map<string, string>,
): string | undefined {
  const [base, ...rest] = splitReference(reference);
  if (!base) {
    return undefined;
  }

  if (inputNames.has(base)) {
    return compileAccess("input", [base, ...rest]);
  }

  if (nodeVariables.has(base)) {
    return compileAccess(nodeVariables.get(base) ?? base, rest);
  }

  return undefined;
}

function escapeTemplateChunk(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

function compileAccess(base: string, segments: string[]): string {
  return segments.reduce((expression, segment) => {
    if (isValidIdentifier(segment)) {
      return `${expression}.${segment}`;
    }

    return `${expression}[${JSON.stringify(segment)}]`;
  }, base);
}

function toTypeAnnotation(typeName: string): string {
  return typeName.trim() || "unknown";
}

function extractCustomTypes(typeName: string): string[] {
  const normalizedType = toTypeAnnotation(typeName);
  const matches = normalizedType.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];

  return matches.filter((match) => !isBuiltinType(match));
}

function formatObjectKey(key: string): string {
  return isValidIdentifier(key) ? key : JSON.stringify(key);
}

function toIdentifier(value: string, fallback: string): string {
  const normalized = value.replace(/[^A-Za-z0-9_]/g, "_");
  if (!normalized) {
    return fallback;
  }

  if (/^[A-Za-z_]/.test(normalized)) {
    return normalized;
  }

  return `${fallback}_${normalized}`;
}

function isValidIdentifier(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function isBuiltinType(value: string): boolean {
  return new Set(["string", "number", "boolean", "unknown", "any", "void"]).has(value);
}

function splitReference(reference: string): string[] {
  return reference
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
}
