import type { GraphIR, IRNode, IROutput } from "./ir.js";

export function compileToTypeScript(ir: GraphIR): string {
  const graphName = toIdentifier(ir.name, "Graph");
  const inputTypeName = `${graphName}Input`;
  const outputTypeName = `${graphName}Output`;
  const inputNames = new Set(ir.inputs.map((input) => input.name));
  const nodeVariables = new Map(ir.nodes.map((node) => [node.id, toIdentifier(node.id, "node")]));
  const referencedNodeProperties = collectReferencedNodeProperties(ir);

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

  return [
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
        type: inferReferenceType(ir, output.reference),
      })),
    ),
    "",
    `export function ${graphName}(input: ${inputTypeName}): ${outputTypeName} {`,
    ...body,
    "}",
    "",
  ].join("\n");
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

  if (node.type === "Text.Template") {
    const template = typeof node.properties.template === "string" ? node.properties.template : "";
    return [
      `  const ${variableName} = {`,
      `    text: ${renderTemplateLiteral(template, inputNames)},`,
      "  };",
      "",
    ];
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

  if (node.type === "Text.Template" && property === "text") {
    return "string";
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

function renderTemplateLiteral(template: string, inputNames: Set<string>): string {
  const pattern = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
  let result = "";
  let lastIndex = 0;
  let match = pattern.exec(template);

  while (match) {
    const [rawMatch, name] = match;
    const start = match.index;
    result += escapeTemplateChunk(template.slice(lastIndex, start));

    if (inputNames.has(name)) {
      result += `\${${compileAccess("input", [name])}}`;
    } else {
      result += escapeTemplateChunk(rawMatch);
    }

    lastIndex = start + rawMatch.length;
    match = pattern.exec(template);
  }

  result += escapeTemplateChunk(template.slice(lastIndex));
  return `\`${result}\``;
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

function splitReference(reference: string): string[] {
  return reference
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
}
