import {
  createDiagnostic,
  createLocation,
  DiagnosticCodes,
  getNodeDefinition,
  listKnownNodes,
  ParserError,
  parseGraph,
  type Diagnostic as MomomDiagnostic,
  type GraphAst,
  type InputAst,
  type MomomValue,
  type NodeAst,
  type SourceLocation,
} from "@momom/core";
import {
  DiagnosticSeverity,
  type Diagnostic,
  type MarkupContent,
  type Position,
  type Range,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

export interface ParsedMomomDocumentSuccess {
  ok: true;
  graph: GraphAst;
}

export interface ParsedMomomDocumentFailure {
  ok: false;
  diagnostics: MomomDiagnostic[];
}

export type ParsedMomomDocument = ParsedMomomDocumentSuccess | ParsedMomomDocumentFailure;

export interface GraphContext {
  graph?: GraphAst;
  inputs: InputAst[];
  nodes: NodeAst[];
}

export interface TokenMatch {
  value: string;
  range: Range;
  startOffset: number;
  endOffset: number;
}

const KEYWORD_DESCRIPTIONS: Record<string, string> = {
  graph: "graph declares the root semantic graph block.",
  input: "input declares a typed external value that can feed nodes and outputs.",
  node: "node declares a graph step using a known Momom node type.",
  edge: "edge connects an input or node output to a target node port.",
  branch: "branch routes execution using a boolean reference.",
  output: "output exposes a graph result using a semantic reference.",
  true: "Boolean literal true.",
  false: "Boolean literal false.",
};

const NODE_TYPE_DESCRIPTIONS: Record<string, string> = {
  "Text.Template": "Text.Template creates a text output using a template string. Output: text: string.",
  "Auth.VerifyToken":
    "Auth.VerifyToken is a deterministic auth node. Required input: token. Output: valid: boolean.",
  "ML.RecommendProducts":
    "ML.RecommendProducts is a probabilistic recommendation node. Required input: products: Product[]. Output: items: Product[].",
  "Action.TriggerAnomaly":
    "Action.TriggerAnomaly triggers an anomaly action placeholder. Output: triggered: boolean.",
};

const RISK_DESCRIPTIONS: Record<string, string> = {
  low: "low risk nodes have minimal operational impact.",
  medium: "medium risk nodes should be reviewed before automation grows.",
  high: "high risk nodes should stay deterministic when possible.",
  critical: "critical nodes cannot use deterministic: false.",
};

export function parseMomomDocument(document: TextDocument): ParsedMomomDocument {
  try {
    return {
      ok: true,
      graph: parseGraph(document.getText(), {
        file: document.uri,
      }),
    };
  } catch (error) {
    if (error instanceof ParserError) {
      return {
        ok: false,
        diagnostics: [
          createDiagnostic(
            DiagnosticCodes.INVALID_GRAPH,
            error.message,
            "error",
            {
              file: document.uri,
              line: error.line,
              column: error.column,
            },
          ),
        ],
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      diagnostics: [
        createDiagnostic(
          DiagnosticCodes.INVALID_GRAPH,
          message,
          "error",
          {
            file: document.uri,
            line: 1,
            column: 1,
          },
        ),
      ],
    };
  }
}

export function getGraphContext(document: TextDocument): GraphContext {
  const parsed = parseMomomDocument(document);
  if (parsed.ok) {
    return {
      graph: parsed.graph,
      inputs: parsed.graph.inputs,
      nodes: parsed.graph.nodes,
    };
  }

  return scanGraphContext(document);
}

export function toLspDiagnostic(document: TextDocument, diagnostic: MomomDiagnostic): Diagnostic {
  return {
    range: createRangeFromLoc(document, diagnostic.loc),
    severity: toLspSeverity(diagnostic.severity),
    message: `[${diagnostic.code}] ${diagnostic.message}`,
    source: "momom",
  };
}

export function toLspSeverity(severity: string): DiagnosticSeverity {
  if (severity === "warning") {
    return DiagnosticSeverity.Warning;
  }

  if (severity === "info") {
    return DiagnosticSeverity.Information;
  }

  return DiagnosticSeverity.Error;
}

export function createRangeFromLoc(document: TextDocument, loc?: SourceLocation): Range {
  if (!loc) {
    return createLineRange(document, 0);
  }

  const lineIndex = clamp(loc.line - 1, 0, Math.max(document.lineCount - 1, 0));
  const lineText = getLineText(document, lineIndex);
  const character = clamp(loc.column - 1, 0, lineText.length);
  const endCharacter = Math.min(character + 1, lineText.length);

  return {
    start: {
      line: lineIndex,
      character,
    },
    end: {
      line: lineIndex,
      character: endCharacter,
    },
  };
}

export function createLineRange(document: TextDocument, lineIndex: number): Range {
  const safeLineIndex = clamp(lineIndex, 0, Math.max(document.lineCount - 1, 0));
  const lineText = getLineText(document, safeLineIndex);

  return {
    start: {
      line: safeLineIndex,
      character: 0,
    },
    end: {
      line: safeLineIndex,
      character: Math.max(lineText.length, 1),
    },
  };
}

export function createWholeDocumentRange(document: TextDocument): Range {
  const lastLineIndex = Math.max(document.lineCount - 1, 0);
  const lastLineText = getLineText(document, lastLineIndex);

  return {
    start: {
      line: 0,
      character: 0,
    },
    end: {
      line: lastLineIndex,
      character: lastLineText.length,
    },
  };
}

export function findIdentifierRangeInLine(
  document: TextDocument,
  lineIndex: number,
  identifier: string,
): Range | undefined {
  const safeLineIndex = clamp(lineIndex, 0, Math.max(document.lineCount - 1, 0));
  const lineText = getLineText(document, safeLineIndex);
  const startCharacter = lineText.indexOf(identifier);
  if (startCharacter < 0) {
    return undefined;
  }

  return {
    start: {
      line: safeLineIndex,
      character: startCharacter,
    },
    end: {
      line: safeLineIndex,
      character: startCharacter + identifier.length,
    },
  };
}

export function getLineText(document: TextDocument, lineIndex: number): string {
  const lineRange = document.getText().split(/\r?\n/g);
  return lineRange[lineIndex] ?? "";
}

export function getLinePrefix(document: TextDocument, position: Position): string {
  const lineText = getLineText(document, position.line);
  return lineText.slice(0, Math.min(position.character, lineText.length));
}

export function getTokenAtPosition(document: TextDocument, position: Position): TokenMatch | undefined {
  const lineText = getLineText(document, position.line);
  if (!lineText) {
    return undefined;
  }

  const safeCharacter = clamp(position.character, 0, lineText.length);
  let startCharacter = safeCharacter;
  let endCharacter = safeCharacter;

  while (startCharacter > 0 && isTokenCharacter(lineText[startCharacter - 1])) {
    startCharacter -= 1;
  }

  while (endCharacter < lineText.length && isTokenCharacter(lineText[endCharacter])) {
    endCharacter += 1;
  }

  if (startCharacter === endCharacter) {
    return undefined;
  }

  return {
    value: lineText.slice(startCharacter, endCharacter),
    range: {
      start: {
        line: position.line,
        character: startCharacter,
      },
      end: {
        line: position.line,
        character: endCharacter,
      },
    },
    startOffset: startCharacter,
    endOffset: endCharacter,
  };
}

export function makeMarkdown(value: string): MarkupContent {
  return {
    kind: "markdown",
    value,
  };
}

export function getKeywordDescription(keyword: string): string | undefined {
  return KEYWORD_DESCRIPTIONS[keyword];
}

export function getNodeTypeDescription(nodeType: string): string | undefined {
  return NODE_TYPE_DESCRIPTIONS[nodeType];
}

export function getRiskDescription(risk: string): string | undefined {
  return RISK_DESCRIPTIONS[risk];
}

export function getDeterministicDescription(): string {
  return "deterministic true means the node should produce predictable results for the same inputs.";
}

export function getInputDescription(input: Pick<InputAst, "name" | "type">): string {
  return `Input \`${input.name}\`: \`${input.type}\`.`;
}

export function getNodeInstanceDescription(node: Pick<NodeAst, "id" | "type">): string {
  const definition = getNodeDefinition(node.type);
  if (!definition) {
    return `Node \`${node.id}\` uses \`${node.type}\`.`;
  }

  const outputs = Object.entries(definition.outputs)
    .map(([name, type]) => `\`${name}: ${type}\``)
    .join(", ");

  return `Node \`${node.id}\` uses \`${node.type}\`. Outputs: ${outputs}.`;
}

export function getOutputDescription(nodeType: string, outputName: string): string | undefined {
  const outputType = getNodeDefinition(nodeType)?.outputs[outputName];
  if (!outputType) {
    return undefined;
  }

  return `Output \`${outputName}\`: \`${outputType}\` from \`${nodeType}\`.`;
}

export function getBooleanOutputs(nodeType: string): string[] {
  return Object.entries(getNodeDefinition(nodeType)?.outputs ?? {})
    .filter(([, type]) => type === "boolean")
    .map(([name]) => name);
}

export function getKnownNodeTypes(): string[] {
  return listKnownNodes().map((node) => node.type);
}

export function makeScannedNode(id: string, type: string, line: number, file: string): NodeAst {
  return {
    kind: "Node",
    id,
    type,
    properties: {},
    loc: createLocation(line, 1, file),
  };
}

function scanGraphContext(document: TextDocument): GraphContext {
  const lines = document.getText().replace(/\r\n/g, "\n").split("\n");
  const inputs: InputAst[] = [];
  const nodes: NodeAst[] = [];
  const file = document.uri;
  let activeNode: NodeAst | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = (lines[index] ?? "").trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#")) {
      continue;
    }

    if (activeNode) {
      if (trimmed === "}") {
        activeNode = undefined;
        continue;
      }

      const propertyMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+?)\s*$/.exec(trimmed);
      if (propertyMatch) {
        activeNode.properties[propertyMatch[1]] = parseScalarValue(propertyMatch[2]);
      }

      continue;
    }

    const inputMatch = /^input\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+?)\s*$/.exec(trimmed);
    if (inputMatch) {
      inputs.push({
        kind: "Input",
        name: inputMatch[1],
        type: inputMatch[2].trim(),
        loc: createLocation(index + 1, 1, file),
      });
      continue;
    }

    const nodeMatch = /^node\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_.]*)\s*\{\s*$/.exec(trimmed);
    if (nodeMatch) {
      activeNode = makeScannedNode(nodeMatch[1], nodeMatch[2], index + 1, file);
      nodes.push(activeNode);
    }
  }

  return {
    inputs,
    nodes,
  };
}

function parseScalarValue(rawValue: string): MomomValue {
  const value = rawValue.trim();

  if (value.startsWith("\"") && value.endsWith("\"")) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isTokenCharacter(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z0-9_.]/.test(character);
}
