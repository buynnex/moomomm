import type { GraphAst, MomomValue } from "./ast.js";
import { getNodeDefinition } from "./node-registry.js";
import { resolveReferenceType } from "./references.js";
import { momomTypeToTypeScript } from "./types.js";

export interface GraphIR {
  kind: "momom.graph";
  version: "0.3";
  name: string;
  inputs: IRInput[];
  nodes: IRNode[];
  edges: IREdge[];
  branches: IRBranch[];
  outputs: IROutput[];
}

export interface IRInput {
  name: string;
  type: string;
}

export interface IRNode {
  id: string;
  type: string;
  intent?: string;
  risk?: string;
  deterministic?: boolean;
  outputs: Record<string, string>;
  properties: Record<string, MomomValue>;
}

export interface IREdge {
  from: string;
  to: string;
}

export interface IRBranchCase {
  value: string;
  target: string;
}

export interface IRBranch {
  source: string;
  cases: IRBranchCase[];
}

export interface IROutput {
  name: string;
  reference: string;
  type?: string;
}

export function buildIR(graph: GraphAst): GraphIR {
  return {
    kind: "momom.graph",
    version: "0.3",
    name: graph.name,
    inputs: graph.inputs.map((input) => ({
      name: input.name,
      type: input.type,
    })),
    nodes: graph.nodes.map((node) => buildIRNode(node)),
    edges: graph.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
    })),
    branches: graph.branches.map((branch) => ({
      source: branch.source,
      cases: branch.cases.map((branchCase) => ({
        value: branchCase.value,
        target: branchCase.target,
      })),
    })),
    outputs: graph.outputs.map((output) => ({
      name: output.name,
      reference: output.reference,
      type: resolveOutputType(graph, output.reference),
    })),
  };
}

function buildIRNode(node: GraphAst["nodes"][number]): IRNode {
  const properties: Record<string, MomomValue> = { ...node.properties };
  const nodeDefinition = getNodeDefinition(node.type);
  const irNode: IRNode = {
    id: node.id,
    type: node.type,
    deterministic:
      typeof properties.deterministic === "boolean" ? properties.deterministic : nodeDefinition?.deterministic,
    outputs: { ...(nodeDefinition?.outputs ?? {}) },
    properties,
  };

  if (typeof properties.intent === "string") {
    irNode.intent = properties.intent;
    delete properties.intent;
  }

  if (typeof properties.risk === "string") {
    irNode.risk = properties.risk;
    delete properties.risk;
  }

  if (typeof properties.deterministic === "boolean") {
    delete properties.deterministic;
  }

  return irNode;
}

function resolveOutputType(graph: GraphAst, reference: string): string | undefined {
  const resolution = resolveReferenceType({ reference, graph });
  if (!resolution.ok) {
    return undefined;
  }

  return momomTypeToTypeScript(resolution.type);
}
