import type { GraphAst, MomomValue } from "./ast.js";
import { analyzeGraphFlow, type ExecutionPlanItem, type ResolvedConnection } from "./flowchecker.js";
import { getNodeDefinition } from "./node-registry.js";
import { resolveReferenceType } from "./references.js";
import { momomTypeToTypeScript } from "./types.js";

export interface GraphIR {
  kind: "momom.graph";
  version: "0.4";
  name: string;
  inputs: IRInput[];
  nodes: IRNode[];
  edges: IREdge[];
  branches: IRBranch[];
  outputs: IROutput[];
  executionPlan: ExecutionPlanItem[];
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
  inputs: Record<string, IRNodeInput>;
  outputs: Record<string, string>;
  properties: Record<string, MomomValue>;
}

export interface IRNodeInput {
  source: string;
  type: string;
  inferred: boolean;
}

export interface IREdge {
  from: string;
  to: string;
  fromType?: string;
  toNode?: string;
  toPort?: string | null;
  acceptedTypes?: string[];
  inferred?: boolean;
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
  const flow = analyzeGraphFlow(graph);
  const connectionBuckets = groupConnectionsByEdge(flow.connections);

  return {
    kind: "momom.graph",
    version: "0.4",
    name: graph.name,
    inputs: graph.inputs.map((input) => ({
      name: input.name,
      type: input.type,
    })),
    nodes: graph.nodes.map((node) => buildIRNode(node, flow.connections)),
    edges: graph.edges.map((edge) => buildIREdge(edge, connectionBuckets)),
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
    executionPlan: flow.executionPlan,
  };
}

function buildIRNode(node: GraphAst["nodes"][number], connections: ResolvedConnection[]): IRNode {
  const properties: Record<string, MomomValue> = { ...node.properties };
  const nodeDefinition = getNodeDefinition(node.type);
  const irNode: IRNode = {
    id: node.id,
    type: node.type,
    deterministic:
      typeof properties.deterministic === "boolean" ? properties.deterministic : nodeDefinition?.deterministic,
    inputs: buildNodeInputs(node.id, connections),
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

function buildIREdge(edge: GraphAst["edges"][number], connectionBuckets: Map<string, ResolvedConnection[]>): IREdge {
  const bucketKey = createEdgeKey(edge.from, edge.to);
  const connection = connectionBuckets.get(bucketKey)?.shift();

  return {
    from: edge.from,
    to: edge.to,
    fromType: connection?.fromType,
    toNode: connection?.toNode ?? edge.targetNode,
    toPort: connection?.toPort ?? edge.targetPort ?? null,
    acceptedTypes: connection?.acceptedTypes,
    inferred: connection?.inferred,
  };
}

function buildNodeInputs(nodeId: string, connections: ResolvedConnection[]): Record<string, IRNodeInput> {
  const inputs: Record<string, IRNodeInput> = {};

  for (const connection of connections) {
    if (connection.toNode !== nodeId || !connection.toPort) {
      continue;
    }

    inputs[connection.toPort] = {
      source: connection.from,
      type: connection.fromType,
      inferred: connection.inferred,
    };
  }

  return inputs;
}

function resolveOutputType(graph: GraphAst, reference: string): string | undefined {
  const resolution = resolveReferenceType({ reference, graph });
  if (!resolution.ok) {
    return undefined;
  }

  return momomTypeToTypeScript(resolution.type);
}

function groupConnectionsByEdge(connections: ResolvedConnection[]): Map<string, ResolvedConnection[]> {
  const buckets = new Map<string, ResolvedConnection[]>();

  for (const connection of connections) {
    const key = createEdgeKey(connection.from, connection.to);
    const bucket = buckets.get(key) ?? [];
    bucket.push(connection);
    buckets.set(key, bucket);
  }

  return buckets;
}

function createEdgeKey(from: string, to: string): string {
  return `${from} -> ${to}`;
}
