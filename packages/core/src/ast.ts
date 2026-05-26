export type MomomScalar = string | number | boolean;
export type MomomValue = MomomScalar;

export interface SourceLocation {
  file?: string;
  line: number;
  column: number;
}

export interface GraphAst {
  kind: "Graph";
  name: string;
  inputs: InputAst[];
  nodes: NodeAst[];
  edges: EdgeAst[];
  branches: BranchAst[];
  outputs: OutputAst[];
  loc?: SourceLocation;
}

export interface InputAst {
  kind: "Input";
  name: string;
  type: string;
  loc?: SourceLocation;
}

export interface NodeAst {
  kind: "Node";
  id: string;
  type: string;
  properties: Record<string, MomomValue>;
  loc?: SourceLocation;
}

export interface EdgeAst {
  kind: "Edge";
  from: string;
  to: string;
  sourceRoot?: string;
  sourcePath?: string[];
  targetNode?: string;
  targetPort?: string | null;
  loc?: SourceLocation;
}

export interface BranchCaseAst {
  value: string;
  target: string;
  loc?: SourceLocation;
}

export interface BranchAst {
  kind: "Branch";
  source: string;
  cases: BranchCaseAst[];
  loc?: SourceLocation;
}

export interface OutputAst {
  kind: "Output";
  name: string;
  reference: string;
  loc?: SourceLocation;
}

export function createLocation(line: number, column: number, file?: string): SourceLocation {
  return {
    file,
    line,
    column,
  };
}
