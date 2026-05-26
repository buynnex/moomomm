import { parseReference } from "@momom/core";
import type { Position } from "vscode-languageserver";

export type MomomCursorContextKind =
  | "top-level"
  | "graph-name"
  | "input-declaration"
  | "input-type"
  | "node-declaration"
  | "node-type"
  | "node-body"
  | "node-property-name"
  | "node-property-value"
  | "edge-source"
  | "edge-target"
  | "edge-target-port"
  | "branch-source"
  | "branch-case-target"
  | "output-name"
  | "output-reference"
  | "output-reference-property"
  | "unknown";

export interface MomomCursorContext {
  lineText: string;
  word: string;
  previousWord?: string;
  context: MomomCursorContextKind;
  nodeId?: string;
  nodeType?: string;
  referenceRoot?: string;
  propertyName?: string;
}

interface ActiveNodeInfo {
  id: string;
  type: string;
}

export function getMomomCursorContext(documentText: string, position: Position): MomomCursorContext {
  const lines = documentText.replace(/\r\n/g, "\n").split("\n");
  const lineText = lines[position.line] ?? "";
  const safeCharacter = Math.min(Math.max(position.character, 0), lineText.length);
  const trimmed = lineText.trim();
  const wordInfo = getWordInfo(lineText, safeCharacter);
  const previousWord = getPreviousWord(lineText, wordInfo.start);
  const activeNode = getActiveNode(lines, position.line);
  const defaultContext: MomomCursorContext = {
    lineText,
    word: wordInfo.word,
    previousWord,
    context: "unknown",
    nodeId: activeNode?.id,
    nodeType: activeNode?.type,
  };

  const graphMatch = /^\s*graph\s+([A-Za-z_][A-Za-z0-9_]*)?/.exec(lineText);
  if (graphMatch) {
    return {
      ...defaultContext,
      context: "graph-name",
    };
  }

  const inputMatch = /^\s*input\s+([A-Za-z_][A-Za-z0-9_]*)?\s*:?\s*(.*)$/.exec(lineText);
  if (inputMatch) {
    const colonIndex = lineText.indexOf(":");
    if (colonIndex < 0 || safeCharacter <= colonIndex) {
      return {
        ...defaultContext,
        context: "input-declaration",
      };
    }

    return {
      ...defaultContext,
      context: "input-type",
    };
  }

  const nodeHeaderMatch = /^\s*node\s+([A-Za-z_][A-Za-z0-9_]*)?\s*:?\s*([A-Za-z_][A-Za-z0-9_.]*)?/.exec(lineText);
  if (nodeHeaderMatch) {
    const colonIndex = lineText.indexOf(":");
    if (colonIndex < 0 || safeCharacter <= colonIndex) {
      return {
        ...defaultContext,
        context: "node-declaration",
        nodeId: nodeHeaderMatch[1],
      };
    }

    return {
      ...defaultContext,
      context: "node-type",
      nodeId: nodeHeaderMatch[1],
      nodeType: nodeHeaderMatch[2],
    };
  }

  const edgeMatch = /^\s*edge\s+(.+?)\s*->\s*(.*)$/.exec(lineText);
  if (edgeMatch) {
    const arrowIndex = lineText.indexOf("->");
    if (arrowIndex < 0 || safeCharacter <= arrowIndex) {
      return {
        ...defaultContext,
        context: "edge-source",
        referenceRoot: parseReference(edgeMatch[1]).root,
      };
    }

    const targetText = edgeMatch[2].trim();
    const parsedTarget = parseReference(targetText);
    const targetStart = lineText.lastIndexOf(targetText);
    const dotIndex = targetText.indexOf(".");
    if (dotIndex >= 0 && safeCharacter > targetStart + dotIndex) {
      return {
        ...defaultContext,
        context: "edge-target-port",
        nodeId: parsedTarget.root,
        referenceRoot: parsedTarget.root,
      };
    }

    return {
      ...defaultContext,
      context: "edge-target",
      nodeId: parsedTarget.root,
      referenceRoot: parsedTarget.root,
    };
  }

  const branchHeaderMatch = /^\s*branch\s+(.+?)\s*\{?\s*$/.exec(lineText);
  if (branchHeaderMatch) {
    const source = branchHeaderMatch[1].trim();
    return {
      ...defaultContext,
      context: "branch-source",
      referenceRoot: parseReference(source).root,
    };
  }

  const branchCaseMatch = /^\s*(.+?)\s*->\s*([A-Za-z_][A-Za-z0-9_]*)?\s*$/.exec(lineText);
  if (branchCaseMatch && !trimmed.startsWith("edge ")) {
    const arrowIndex = lineText.indexOf("->");
    if (arrowIndex >= 0 && safeCharacter > arrowIndex) {
      return {
        ...defaultContext,
        context: "branch-case-target",
        nodeId: branchCaseMatch[2],
      };
    }
  }

  const outputMatch = /^\s*output\s+([A-Za-z_][A-Za-z0-9_]*)?\s*:?\s*(.*)$/.exec(lineText);
  if (outputMatch) {
    const colonIndex = lineText.indexOf(":");
    if (colonIndex < 0 || safeCharacter <= colonIndex) {
      return {
        ...defaultContext,
        context: "output-name",
      };
    }

    const referenceText = outputMatch[2].trim();
    const parsedReference = parseReference(referenceText);
    const referenceStart = lineText.lastIndexOf(referenceText);
    const dotIndex = referenceText.indexOf(".");
    if (dotIndex >= 0 && safeCharacter > referenceStart + dotIndex) {
      return {
        ...defaultContext,
        context: "output-reference-property",
        referenceRoot: parsedReference.root,
      };
    }

    return {
      ...defaultContext,
      context: "output-reference",
      referenceRoot: parsedReference.root,
    };
  }

  if (activeNode) {
    if (!trimmed || trimmed === "}") {
      return {
        ...defaultContext,
        context: "node-body",
      };
    }

    const propertyMatch = /^\s*([A-Za-z_][A-Za-z0-9_]*)?\s*:?\s*(.*)$/.exec(lineText);
    if (propertyMatch) {
      const colonIndex = lineText.indexOf(":");
      if (colonIndex < 0 || safeCharacter <= colonIndex) {
        return {
          ...defaultContext,
          context: "node-property-name",
          propertyName: propertyMatch[1],
        };
      }

      return {
        ...defaultContext,
        context: "node-property-value",
        propertyName: propertyMatch[1],
      };
    }

    return {
      ...defaultContext,
      context: "node-body",
    };
  }

  if (!trimmed || trimmed === "}" || trimmed.startsWith("//") || trimmed.startsWith("#")) {
    return {
      ...defaultContext,
      context: "top-level",
    };
  }

  if (/^(input|node|edge|branch|output)\b/.test(trimmed)) {
    return {
      ...defaultContext,
      context: "top-level",
    };
  }

  return defaultContext;
}

function getActiveNode(lines: string[], currentLineIndex: number): ActiveNodeInfo | undefined {
  let activeNode: ActiveNodeInfo | undefined;

  for (let lineIndex = 0; lineIndex <= currentLineIndex; lineIndex += 1) {
    const trimmed = (lines[lineIndex] ?? "").trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#")) {
      continue;
    }

    const nodeMatch = /^node\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_.]*)\s*\{\s*$/.exec(trimmed);
    if (nodeMatch) {
      activeNode = {
        id: nodeMatch[1],
        type: nodeMatch[2],
      };
      continue;
    }

    if (trimmed === "}" && activeNode) {
      activeNode = undefined;
    }
  }

  return activeNode;
}

function getWordInfo(lineText: string, character: number): { word: string; start: number } {
  let start = character;
  let end = character;

  while (start > 0 && isWordCharacter(lineText[start - 1])) {
    start -= 1;
  }

  while (end < lineText.length && isWordCharacter(lineText[end])) {
    end += 1;
  }

  return {
    word: lineText.slice(start, end),
    start,
  };
}

function getPreviousWord(lineText: string, currentWordStart: number): string | undefined {
  const prefix = lineText.slice(0, currentWordStart);
  const matches = [...prefix.matchAll(/[A-Za-z_][A-Za-z0-9_.]*/g)];
  return matches.at(-1)?.[0];
}

function isWordCharacter(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z0-9_.]/.test(character);
}
