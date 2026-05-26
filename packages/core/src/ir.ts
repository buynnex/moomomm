import type { GraphAst, MomomValue } from "./ast.js";

export interface GraphIR {
  kind: "momom.graph";
  version: "0.1";
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
  properties: Record<string, MomomValue>;
}

export interface IREdge {
  from: string;
  to: string;
}

export interface IRBranchCase {
  when: string;
  target: string;
}

export interface IRBranch {
  source: string;
  cases: IRBranchCase[];
}

export interface IROutput {
  name: string;
  reference: string;
}

export function buildIR(graph: GraphAst): GraphIR {
  return {
    kind: "momom.graph",
    version: "0.1",
    name: graph.name,
    inputs: graph.inputs.map((input) => ({
      name: input.name,
      type: input.type,
    })),
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      properties: { ...node.properties },
    })),
    edges: graph.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
    })),
    branches: graph.branches.map((branch) => ({
      source: branch.source,
      cases: branch.cases.map((branchCase) => ({
        when: branchCase.value,
        target: branchCase.target,
      })),
    })),
    outputs: graph.outputs.map((output) => ({
      name: output.name,
      reference: output.reference,
    })),
  };
}
