import {
  analyzeGraphFlow,
  createDiagnostic,
  createLocation,
  DiagnosticCodes,
  extractTemplateVariables,
  getNodeDefinition,
  listKnownNodes,
  ParserError,
  parseGraph,
  parseReference,
  resolveNodeContract,
  resolveReferenceType,
  type Diagnostic as MomomDiagnostic,
  type EdgeAst,
  type GraphAst,
  type GraphFlowAnalysis,
  type InputAst,
  type MomomValue,
  type NodeAst,
  type SourceLocation,
} from "@momom/core";
import {
  DiagnosticSeverity,
  type Diagnostic,
  type Location,
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

export interface TokenSegmentMatch {
  kind: "whole" | "root" | "property";
  root: string;
  property?: string;
  range: Range;
  fullRange: Range;
}

export interface TemplateVariableMatch {
  value: string;
  range: Range;
  fullRange: Range;
}

export interface ParsedGraphAnalysis {
  graph: GraphAst;
  flow: GraphFlowAnalysis;
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
  "Text.Template": "Creates text from a template. Output: text: string.",
  "Auth.VerifyToken": "Verifies a token deterministically. Required input: token. Output: valid: boolean.",
  "ML.RecommendProducts": "Recommends products probabilistically. Required input: products. Output: items: Product[].",
  "Action.TriggerAnomaly": "Triggers an anomaly action placeholder. Output: triggered: boolean.",
};

const RISK_DESCRIPTIONS: Record<string, string> = {
  low: "low risk nodes have minimal operational impact.",
  medium: "medium risk nodes should be reviewed before automation grows.",
  high: "high risk nodes should stay deterministic when possible.",
  critical: "Critical nodes cannot be probabilistic. deterministic: false is forbidden.",
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

export function getParsedGraphAnalysis(document: TextDocument): ParsedGraphAnalysis | undefined {
  const parsed = parseMomomDocument(document);
  if (!parsed.ok) {
    return undefined;
  }

  return {
    graph: parsed.graph,
    flow: analyzeGraphFlow(parsed.graph),
  };
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

export function findSubstringRangeInLine(
  document: TextDocument,
  lineIndex: number,
  search: string,
): Range | undefined {
  const lineText = getLineText(document, lineIndex);
  const startCharacter = lineText.indexOf(search);
  if (startCharacter < 0) {
    return undefined;
  }

  return {
    start: {
      line: lineIndex,
      character: startCharacter,
    },
    end: {
      line: lineIndex,
      character: startCharacter + search.length,
    },
  };
}

export function findReferenceRootRangeInLine(
  document: TextDocument,
  lineIndex: number,
  reference: string,
): Range | undefined {
  const lineText = getLineText(document, lineIndex);
  const startCharacter = lineText.indexOf(reference);
  if (startCharacter < 0) {
    return undefined;
  }

  const root = parseReference(reference).root;
  return {
    start: {
      line: lineIndex,
      character: startCharacter,
    },
    end: {
      line: lineIndex,
      character: startCharacter + root.length,
    },
  };
}

export function getLineText(document: TextDocument, lineIndex: number): string {
  const lines = document.getText().split(/\r?\n/g);
  return lines[lineIndex] ?? "";
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

export function getTokenSegmentAtPosition(token: TokenMatch, position: Position): TokenSegmentMatch {
  const dotIndex = token.value.indexOf(".");
  if (dotIndex < 0) {
    return {
      kind: "whole",
      root: token.value,
      range: token.range,
      fullRange: token.range,
    };
  }

  const relativeCharacter = position.character - token.startOffset;
  const root = token.value.slice(0, dotIndex);
  const property = token.value.slice(dotIndex + 1);

  if (relativeCharacter <= dotIndex) {
    return {
      kind: "root",
      root,
      property,
      range: {
        start: token.range.start,
        end: {
          line: token.range.start.line,
          character: token.range.start.character + root.length,
        },
      },
      fullRange: token.range,
    };
  }

  return {
    kind: "property",
    root,
    property,
    range: {
      start: {
        line: token.range.start.line,
        character: token.range.start.character + dotIndex + 1,
      },
      end: token.range.end,
    },
    fullRange: token.range,
  };
}

export function getTemplateVariableAtPosition(
  document: TextDocument,
  position: Position,
): TemplateVariableMatch | undefined {
  const lineText = getLineText(document, position.line);
  const pattern = /\{([^{}]+)\}/g;
  let match = pattern.exec(lineText);

  while (match) {
    const rawValue = match[1];
    const trimmedValue = rawValue.trim();
    if (!trimmedValue) {
      match = pattern.exec(lineText);
      continue;
    }

    const leadingSpaces = rawValue.length - rawValue.trimStart().length;
    const trailingSpaces = rawValue.length - rawValue.trimEnd().length;
    const startCharacter = match.index + 1 + leadingSpaces;
    const endCharacter = match.index + 1 + rawValue.length - trailingSpaces;

    if (position.character >= startCharacter && position.character <= endCharacter) {
      return {
        value: trimmedValue,
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
        fullRange: {
          start: {
            line: position.line,
            character: match.index,
          },
          end: {
            line: position.line,
            character: match.index + match[0].length,
          },
        },
      };
    }

    match = pattern.exec(lineText);
  }

  pattern.lastIndex = 0;
  return undefined;
}

export function findTemplateVariableRanges(document: TextDocument, variableName: string): Range[] {
  return findTemplateReferenceRanges(document, variableName);
}

export function findTemplateReferenceRanges(document: TextDocument, reference: string): Range[] {
  const ranges: Range[] = [];
  const lines = document.getText().replace(/\r\n/g, "\n").split("\n");

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const lineText = lines[lineIndex] ?? "";
    const pattern = /\{([^{}]+)\}/g;
    let match = pattern.exec(lineText);

    while (match) {
      const rawValue = match[1];
      if (rawValue.trim() === reference) {
        const leadingSpaces = rawValue.length - rawValue.trimStart().length;
        const trailingSpaces = rawValue.length - rawValue.trimEnd().length;
        ranges.push({
          start: {
            line: lineIndex,
            character: match.index + 1 + leadingSpaces,
          },
          end: {
            line: lineIndex,
            character: match.index + 1 + rawValue.length - trailingSpaces,
          },
        });
      }

      match = pattern.exec(lineText);
    }

    pattern.lastIndex = 0;
  }

  return ranges;
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
  return "deterministic true means predictable output for same input. deterministic false is allowed for ML/recommendation nodes but forbidden for critical nodes.";
}

export function getInputDescription(input: Pick<InputAst, "name" | "type">): string {
  return `\`\`\`momom\ninput ${input.name}: ${input.type}\n\`\`\`\n\nInput declared in graph.`;
}

export function getNodeInstanceDescription(
  node: Pick<NodeAst, "id" | "type" | "properties">,
  flow?: GraphFlowAnalysis,
): string {
  const contract = resolveNodeContract(node);
  if (!contract) {
    return `\`\`\`momom\nnode ${node.id}: ${node.type}\n\`\`\``;
  }

  const deterministicValue =
    typeof node.properties?.deterministic === "boolean" ? String(node.properties.deterministic) : String(contract.deterministic);
  const riskValue =
    typeof node.properties?.risk === "string" ? node.properties.risk : contract.riskDefault ?? "unspecified";
  const connectedInputs = flow?.connections
    .filter((connection) => connection.toNode === node.id)
    .map((connection) => `- ${connection.toPort ?? "<implicit>"} <- ${connection.from} (${connection.fromType})`)
    .join("\n");
  const outputs = Object.entries(contract.outputs)
    .map(([name, type]) => `- ${name}: ${type}`)
    .join("\n");

  return [
    "```momom",
    `node ${node.id}: ${node.type}`,
    "```",
    "",
    `deterministic: ${deterministicValue}`,
    `risk: ${riskValue}`,
    "",
    "inputs connected:",
    connectedInputs || "- none yet",
    "",
    "outputs:",
    outputs || "- none",
  ].join("\n");
}

export function getKnownNodeTypes(): string[] {
  return listKnownNodes().map((node) => node.type);
}

export function getKnownInputTypeSuggestions(): string[] {
  return ["string", "number", "boolean", "unknown", "any", "User", "Token", "Product", "Product[]"];
}

export function getNodeOutputReferences(nodes: NodeAst[]): string[] {
  const references: string[] = [];

  for (const node of nodes) {
    for (const [outputName] of Object.entries(getNodeDefinition(node.type)?.outputs ?? {})) {
      references.push(`${node.id}.${outputName}`);
    }
  }

  return references;
}

export function getBooleanOutputReferences(nodes: NodeAst[]): string[] {
  return nodes.flatMap((node) =>
    Object.entries(getNodeDefinition(node.type)?.outputs ?? {})
      .filter(([, outputType]) => outputType === "boolean")
      .map(([outputName]) => `${node.id}.${outputName}`),
  );
}

export function getNodePropertyNames(nodeType: string | undefined): string[] {
  const definition = nodeType ? getNodeDefinition(nodeType) : undefined;
  if (!definition) {
    return ["intent", "risk", "deterministic", "template", "topK"];
  }

  return (definition.properties ?? []).map((property) => property.name);
}

export function getNodeContractMarkdown(nodeType: string): string | undefined {
  const definition = getNodeDefinition(nodeType);
  if (!definition) {
    return undefined;
  }

  const requiredInputs = definition.inputs.filter((input) => input.required);
  const optionalInputs = definition.inputs.filter((input) => !input.required);
  const outputs = Object.entries(definition.outputs)
    .map(([name, type]) => `- ${name}: ${type}`)
    .join("\n");
  const properties = (definition.properties ?? [])
    .map((property) => `- ${property.name}: ${property.type}${property.required ? " (required)" : ""}`)
    .join("\n");

  return [
    `# ${nodeType}`,
    "",
    `category: ${definition.category}`,
    `compileStrategy: ${definition.compileStrategy}`,
    `deterministic default: ${definition.deterministic}`,
    "",
    "required inputs:",
    requiredInputs.length > 0
      ? requiredInputs.map((input) => `- ${input.name}: ${input.types.join(" | ")}`).join("\n")
      : "- none",
    "",
    "optional inputs:",
    optionalInputs.length > 0
      ? optionalInputs.map((input) => `- ${input.name}: ${input.types.join(" | ")}`).join("\n")
      : "- none",
    "",
    "outputs:",
    outputs || "- none",
    "",
    "properties:",
    properties || "- none",
  ].join("\n");
}

export function getResolvedReferenceMarkdown(reference: string, graph: GraphAst): string | undefined {
  const resolution = resolveReferenceType({ reference, graph });
  if (!resolution.ok) {
    return undefined;
  }

  const parsedReference = parseReference(reference);
  return [
    `\`\`\`momom\n${reference}\n\`\`\``,
    "",
    `root: ${parsedReference.root}`,
    `property: ${parsedReference.path[0] ?? "<implicit>"}`,
    `resolved type: ${resolution.type.raw}`,
  ].join("\n");
}

export function getBranchSourceMarkdown(reference: string, graph: GraphAst): string | undefined {
  const resolution = resolveReferenceType({ reference, graph });
  if (!resolution.ok) {
    return undefined;
  }

  return [
    `\`\`\`momom\nbranch ${reference}\n\`\`\``,
    "",
    `resolved type: ${resolution.type.raw}`,
    resolution.type.raw === "boolean"
      ? "This branch source resolves to boolean."
      : "Warning: branch sources should resolve to boolean.",
  ].join("\n");
}

export function getEdgeConnectionMarkdown(edge: EdgeAst, flow: GraphFlowAnalysis): string | undefined {
  const connection = flow.connections.find((candidate) => candidate.from === edge.from && candidate.to === edge.to);
  if (!connection) {
    return undefined;
  }

  return [
    `\`\`\`momom\nedge ${edge.from} -> ${edge.to}\n\`\`\``,
    "",
    `source type: ${connection.fromType}`,
    `target node: ${connection.toNode}`,
    `target port: ${connection.toPort ?? "<implicit>"}`,
    `accepted types: ${connection.acceptedTypes.join(", ") || "<any>"}`,
    `inferred: ${connection.inferred}`,
  ].join("\n");
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

export function findNodeById(nodes: NodeAst[], nodeId: string): NodeAst | undefined {
  return nodes.find((node) => node.id === nodeId);
}

export function findInputByName(inputs: InputAst[], inputName: string): InputAst | undefined {
  return inputs.find((input) => input.name === inputName);
}

export function findEdgeAtLine(graph: GraphAst, lineNumber: number): EdgeAst | undefined {
  return graph.edges.find((edge) => edge.loc?.line === lineNumber);
}

export function findBranchAtLine(graph: GraphAst, lineNumber: number): GraphAst["branches"][number] | undefined {
  return graph.branches.find(
    (branch) =>
      branch.loc?.line === lineNumber || branch.cases.some((branchCase) => branchCase.loc?.line === lineNumber),
  );
}

export function createLocationFromRange(uri: string, range: Range): Location {
  return {
    uri,
    range,
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

      const propertyMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*?)\s*$/.exec(trimmed);
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

  const templateVariables = extractTemplateVariables(value);
  if (templateVariables.length > 0) {
    return value;
  }

  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isTokenCharacter(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z0-9_.]/.test(character);
}
