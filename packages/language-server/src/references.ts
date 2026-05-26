import { parseReference } from "@momom/core";
import type { Location, Position, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { getMomomCursorContext } from "./context.js";
import {
  createLocationFromRange,
  findIdentifierRangeInLine,
  findInputByName,
  findNodeById,
  findReferenceRootRangeInLine,
  findSubstringRangeInLine,
  findTemplateReferenceRanges,
  findTemplateVariableRanges,
  getTemplateVariableAtPosition,
  getTokenAtPosition,
  getTokenSegmentAtPosition,
  parseMomomDocument,
} from "./utils.js";

export type MomomSymbolTarget =
  | {
      kind: "input";
      name: string;
      range: Range;
    }
  | {
      kind: "node";
      name: string;
      range: Range;
    }
  | {
      kind: "reference";
      reference: string;
      root: string;
      property: string;
      range: Range;
    };

export function getReferences(document: TextDocument, position: Position, includeDeclaration = true): Location[] {
  const target = getSymbolTargetAtPosition(document, position);
  if (!target) {
    return [];
  }

  return collectReferencesForTarget(document, target, includeDeclaration);
}

export function getSymbolTargetAtPosition(
  document: TextDocument,
  position: Position,
): MomomSymbolTarget | undefined {
  const parsed = parseMomomDocument(document);
  if (!parsed.ok) {
    return undefined;
  }

  const templateVariable = getTemplateVariableAtPosition(document, position);
  if (templateVariable && findInputByName(parsed.graph.inputs, templateVariable.value)) {
    return {
      kind: "input",
      name: templateVariable.value,
      range: templateVariable.range,
    };
  }

  const token = getTokenAtPosition(document, position);
  if (!token) {
    return undefined;
  }

  const cursorContext = getMomomCursorContext(document.getText(), position);
  const segment = getTokenSegmentAtPosition(token, position);

  if (segment.kind === "property") {
    const node = findNodeById(parsed.graph.nodes, segment.root);
    if (node && segment.property) {
      return {
        kind: "reference",
        reference: `${segment.root}.${segment.property}`,
        root: segment.root,
        property: segment.property,
        range: segment.range,
      };
    }

    return undefined;
  }

  const input = findInputByName(parsed.graph.inputs, segment.root);
  if (input) {
    return {
      kind: "input",
      name: input.name,
      range: segment.range,
    };
  }

  const node = findNodeById(parsed.graph.nodes, segment.root);
  if (
    node &&
    [
      "node-declaration",
      "edge-source",
      "edge-target",
      "edge-target-port",
      "branch-source",
      "branch-case-target",
      "output-reference",
      "output-reference-property",
      "unknown",
    ].includes(cursorContext.context)
  ) {
    return {
      kind: "node",
      name: node.id,
      range: segment.range,
    };
  }

  return undefined;
}

export function collectReferencesForTarget(
  document: TextDocument,
  target: MomomSymbolTarget,
  includeDeclaration = true,
): Location[] {
  const parsed = parseMomomDocument(document);
  if (!parsed.ok) {
    return [];
  }

  const { graph } = parsed;
  const ranges: Range[] = [];

  if (target.kind === "input") {
    const input = findInputByName(graph.inputs, target.name);
    if (includeDeclaration && input?.loc) {
      const declarationRange = findIdentifierRangeInLine(document, Math.max(input.loc.line - 1, 0), target.name);
      if (declarationRange) {
        ranges.push(declarationRange);
      }
    }

    for (const edge of graph.edges) {
      const parsedReference = parseReference(edge.from);
      if (parsedReference.root === target.name && parsedReference.path.length === 0 && edge.loc) {
        const range = findReferenceRootRangeInLine(document, Math.max(edge.loc.line - 1, 0), edge.from);
        if (range) {
          ranges.push(range);
        }
      }
    }

    for (const output of graph.outputs) {
      const parsedReference = parseReference(output.reference);
      if (parsedReference.root === target.name && parsedReference.path.length === 0 && output.loc) {
        const range = findReferenceRootRangeInLine(document, Math.max(output.loc.line - 1, 0), output.reference);
        if (range) {
          ranges.push(range);
        }
      }
    }

    for (const branch of graph.branches) {
      const parsedReference = parseReference(branch.source);
      if (parsedReference.root === target.name && branch.loc) {
        const range = findReferenceRootRangeInLine(document, Math.max(branch.loc.line - 1, 0), branch.source);
        if (range) {
          ranges.push(range);
        }
      }
    }

    ranges.push(...findTemplateVariableRanges(document, target.name));
  }

  if (target.kind === "node") {
    const node = findNodeById(graph.nodes, target.name);
    if (includeDeclaration && node?.loc) {
      const declarationRange = findIdentifierRangeInLine(document, Math.max(node.loc.line - 1, 0), target.name);
      if (declarationRange) {
        ranges.push(declarationRange);
      }
    }

    for (const edge of graph.edges) {
      if (!edge.loc) {
        continue;
      }

      if (parseReference(edge.from).root === target.name) {
        const range = findReferenceRootRangeInLine(document, Math.max(edge.loc.line - 1, 0), edge.from);
        if (range) {
          ranges.push(range);
        }
      }

      if (parseReference(edge.to).root === target.name) {
        const range = findReferenceRootRangeInLine(document, Math.max(edge.loc.line - 1, 0), edge.to);
        if (range) {
          ranges.push(range);
        }
      }
    }

    for (const branch of graph.branches) {
      if (branch.loc && parseReference(branch.source).root === target.name) {
        const range = findReferenceRootRangeInLine(document, Math.max(branch.loc.line - 1, 0), branch.source);
        if (range) {
          ranges.push(range);
        }
      }

      for (const branchCase of branch.cases) {
        if (branchCase.target === target.name && branchCase.loc) {
          const range = findIdentifierRangeInLine(document, Math.max(branchCase.loc.line - 1, 0), target.name);
          if (range) {
            ranges.push(range);
          }
        }
      }
    }

    for (const output of graph.outputs) {
      if (parseReference(output.reference).root === target.name && output.loc) {
        const range = findReferenceRootRangeInLine(document, Math.max(output.loc.line - 1, 0), output.reference);
        if (range) {
          ranges.push(range);
        }
      }
    }

    ranges.push(...findTemplateReferenceRanges(document, target.name));
  }

  if (target.kind === "reference") {
    for (const edge of graph.edges) {
      if (edge.from === target.reference && edge.loc) {
        const range = findSubstringRangeInLine(document, Math.max(edge.loc.line - 1, 0), target.reference);
        if (range) {
          ranges.push(range);
        }
      }
    }

    for (const branch of graph.branches) {
      if (branch.source === target.reference && branch.loc) {
        const range = findSubstringRangeInLine(document, Math.max(branch.loc.line - 1, 0), target.reference);
        if (range) {
          ranges.push(range);
        }
      }
    }

    for (const output of graph.outputs) {
      if (output.reference === target.reference && output.loc) {
        const range = findSubstringRangeInLine(document, Math.max(output.loc.line - 1, 0), target.reference);
        if (range) {
          ranges.push(range);
        }
      }
    }

    ranges.push(...findTemplateReferenceRanges(document, target.reference));
  }

  return dedupeRanges(ranges).map((range) => createLocationFromRange(document.uri, range));
}

function dedupeRanges(ranges: Range[]): Range[] {
  const seen = new Set<string>();

  return ranges.filter((range) => {
    const key = [range.start.line, range.start.character, range.end.line, range.end.character].join(":");
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
