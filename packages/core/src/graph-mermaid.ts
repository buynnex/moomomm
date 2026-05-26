import type { GraphAst } from "./ast.js";
import { parseReference } from "./references.js";

export function graphToMermaid(graph: GraphAst): string {
  const inputIds = new Map(graph.inputs.map((input) => [input.name, `input_${sanitizeId(input.name)}`]));
  const nodeIds = new Map(graph.nodes.map((node) => [node.id, sanitizeId(node.id)]));
  const outputIds = new Map(graph.outputs.map((output) => [output.name, `output_${sanitizeId(output.name)}`]));

  const lines = ["flowchart TD"];

  for (const input of graph.inputs) {
    lines.push(`  ${inputIds.get(input.name)}["input ${escapeLabel(input.name)}: ${escapeLabel(input.type)}"]`);
  }

  for (const node of graph.nodes) {
    lines.push(`  ${nodeIds.get(node.id)}["${escapeLabel(node.id)}: ${escapeLabel(node.type)}"]`);
  }

  for (const output of graph.outputs) {
    lines.push(`  ${outputIds.get(output.name)}["output ${escapeLabel(output.name)}"]`);
  }

  for (const edge of graph.edges) {
    lines.push(
      `  ${toMermaidNodeId(parseReference(edge.from).root, inputIds, nodeIds)} --> ${toMermaidNodeId(
        parseReference(edge.to).root,
        inputIds,
        nodeIds,
      )}`,
    );
  }

  for (const branch of graph.branches) {
    const [sourceNode] = splitReference(branch.source);
    const sourceId = toMermaidNodeId(sourceNode, inputIds, nodeIds);
    for (const branchCase of branch.cases) {
      lines.push(
        `  ${sourceId} -->|"${escapeLabel(branchCase.value)}"| ${toMermaidNodeId(branchCase.target, inputIds, nodeIds)}`,
      );
    }
  }

  for (const output of graph.outputs) {
    const [baseReference] = splitReference(output.reference);
    lines.push(`  ${toMermaidNodeId(baseReference, inputIds, nodeIds)} --> ${outputIds.get(output.name)}`);
  }

  return lines.join("\n");
}

function toMermaidNodeId(
  reference: string,
  inputIds: Map<string, string>,
  nodeIds: Map<string, string>,
): string {
  return inputIds.get(reference) ?? nodeIds.get(reference) ?? sanitizeId(reference);
}

function sanitizeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_]/g, "_");
}

function escapeLabel(value: string): string {
  return value.replace(/"/g, '\\"');
}

function splitReference(reference: string): string[] {
  return parseReference(reference).path.length > 0
    ? [parseReference(reference).root, ...parseReference(reference).path]
    : [parseReference(reference).root].filter(Boolean);
}
