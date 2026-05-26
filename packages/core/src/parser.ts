import {
  createLocation,
  type BranchAst,
  type BranchCaseAst,
  type EdgeAst,
  type GraphAst,
  type InputAst,
  type MomomValue,
  type NodeAst,
  type OutputAst,
} from "./ast.js";

export interface ParseOptions {
  file?: string;
}

export class ParserError extends Error {
  constructor(
    message: string,
    readonly line: number,
    readonly column: number,
  ) {
    super(message);
    this.name = "ParserError";
  }
}

export function parseGraph(source: string, options: ParseOptions = {}): GraphAst {
  const normalized = source.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const file = options.file;
  let index = 0;

  const currentLine = (): string => lines[index] ?? "";
  const currentLineNumber = (): number => index + 1;
  const isIgnorable = (line: string): boolean => {
    const trimmed = line.trim();
    return trimmed === "" || trimmed.startsWith("//") || trimmed.startsWith("#");
  };

  const skipIgnorable = (): void => {
    while (index < lines.length && isIgnorable(lines[index] ?? "")) {
      index += 1;
    }
  };

  const syntaxError = (message: string, column = 1): never => {
    throw new ParserError(`${message} at line ${currentLineNumber()}`, currentLineNumber(), column);
  };

  skipIgnorable();

  const header = currentLine().trim();
  const headerMatch = /^graph\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{\s*$/.exec(header);
  if (!headerMatch) {
    syntaxError("Expected graph declaration");
  }
  const graphName = headerMatch![1];

  const graph: GraphAst = {
    kind: "Graph",
    name: graphName,
    inputs: [],
    nodes: [],
    edges: [],
    branches: [],
    outputs: [],
    loc: createLocation(currentLineNumber(), 1, file),
  };

  index += 1;

  while (index < lines.length) {
    skipIgnorable();
    if (index >= lines.length) {
      break;
    }

    const rawLine = currentLine();
    const trimmed = rawLine.trim();

    if (trimmed === "}") {
      index += 1;
      break;
    }

    if (trimmed.startsWith("input ")) {
      graph.inputs.push(parseInput(trimmed));
      index += 1;
      continue;
    }

    if (trimmed.startsWith("node ")) {
      graph.nodes.push(parseNode());
      continue;
    }

    if (trimmed.startsWith("edge ")) {
      graph.edges.push(parseEdge(trimmed));
      index += 1;
      continue;
    }

    if (trimmed.startsWith("branch ")) {
      graph.branches.push(parseBranch());
      continue;
    }

    if (trimmed.startsWith("output ")) {
      graph.outputs.push(parseOutput(trimmed));
      index += 1;
      continue;
    }

    syntaxError(`Unexpected statement "${trimmed}"`);
  }

  skipIgnorable();
  if (index < lines.length) {
    syntaxError("Unexpected content after graph block");
  }

  return graph;

  function parseInput(trimmed: string): InputAst {
    const match = /^input\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+?)\s*$/.exec(trimmed);
    if (!match) {
      syntaxError(`Invalid input declaration "${trimmed}"`);
    }
    const [, name, type] = match!;

    return {
      kind: "Input",
      name,
      type: type.trim(),
      loc: createLocation(currentLineNumber(), 1, file),
    };
  }

  function parseNode(): NodeAst {
    const headerLine = currentLine().trim();
    const headerMatchNode = /^node\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_.]*)\s*\{\s*$/.exec(
      headerLine,
    );

    if (!headerMatchNode) {
      syntaxError(`Invalid node declaration "${headerLine}"`);
    }
    const [, nodeId, nodeType] = headerMatchNode!;

    const loc = createLocation(currentLineNumber(), 1, file);
    const properties: Record<string, MomomValue> = {};
    index += 1;

    while (index < lines.length) {
      skipIgnorable();
      if (index >= lines.length) {
        syntaxError("Unterminated node block");
      }

      const inner = currentLine().trim();
      if (inner === "}") {
        index += 1;
        break;
      }

      const propertyMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+?)\s*$/.exec(inner);
      if (!propertyMatch) {
        syntaxError(`Invalid node property "${inner}"`);
      }
      const [, propertyName, propertyValue] = propertyMatch!;

      properties[propertyName] = parseValue(propertyValue);
      index += 1;
    }

    return {
      kind: "Node",
      id: nodeId,
      type: nodeType,
      properties,
      loc,
    };
  }

  function parseEdge(trimmed: string): EdgeAst {
    const match = /^edge\s+([A-Za-z_][A-Za-z0-9_]*)\s*->\s*([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(trimmed);
    if (!match) {
      syntaxError(`Invalid edge declaration "${trimmed}"`);
    }
    const [, from, to] = match!;

    return {
      kind: "Edge",
      from,
      to,
      loc: createLocation(currentLineNumber(), 1, file),
    };
  }

  function parseBranch(): BranchAst {
    const headerLine = currentLine().trim();
    const branchHeaderMatch = /^branch\s+([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?)\s*\{\s*$/.exec(
      headerLine,
    );

    if (!branchHeaderMatch) {
      syntaxError(`Invalid branch declaration "${headerLine}"`);
    }
    const [, sourceReference] = branchHeaderMatch!;

    const loc = createLocation(currentLineNumber(), 1, file);
    const cases: BranchCaseAst[] = [];
    index += 1;

    while (index < lines.length) {
      skipIgnorable();
      if (index >= lines.length) {
        syntaxError("Unterminated branch block");
      }

      const inner = currentLine().trim();
      if (inner === "}") {
        index += 1;
        break;
      }

      const caseMatch = /^(.+?)\s*->\s*([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(inner);
      if (!caseMatch) {
        syntaxError(`Invalid branch case "${inner}"`);
      }
      const [, caseValue, caseTarget] = caseMatch!;

      cases.push({
        value: normalizeCaseValue(caseValue),
        target: caseTarget,
        loc: createLocation(currentLineNumber(), 1, file),
      });

      index += 1;
    }

    return {
      kind: "Branch",
      source: sourceReference,
      cases,
      loc,
    };
  }

  function parseOutput(trimmed: string): OutputAst {
    const match = /^output\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+?)\s*$/.exec(trimmed);
    if (!match) {
      syntaxError(`Invalid output declaration "${trimmed}"`);
    }
    const [, name, reference] = match!;

    return {
      kind: "Output",
      name,
      reference: reference.trim(),
      loc: createLocation(currentLineNumber(), 1, file),
    };
  }
}

function parseValue(rawValue: string): MomomValue {
  const value = rawValue.trim();

  if (value.startsWith("\"") && value.endsWith("\"")) {
    return JSON.parse(value) as string;
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  if (/^[+-]?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }

  return value;
}

function normalizeCaseValue(rawValue: string): string {
  const value = rawValue.trim();

  if (value.startsWith("\"") && value.endsWith("\"")) {
    return JSON.parse(value) as string;
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  return value;
}
