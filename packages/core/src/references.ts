import type { GraphAst, InputAst, NodeAst } from "./ast.js";
import { DiagnosticCodes, type DiagnosticCode } from "./diagnostics.js";
import { getNodeDefinition } from "./node-registry.js";
import { parseMomomType, type MomomType } from "./types.js";

export interface ParsedReference {
  root: string;
  path: string[];
  raw: string;
}

export type ReferenceResolutionErrorReason = "missing-reference" | "missing-property" | "unresolved-type";

export type ReferenceResolution =
  | {
      ok: true;
      reference: ParsedReference;
      type: MomomType;
      sourceKind: "input" | "node-output";
      node?: NodeAst;
      input?: InputAst;
    }
  | {
      ok: false;
      reference: ParsedReference;
      code: DiagnosticCode;
      reason: ReferenceResolutionErrorReason;
      message: string;
      node?: NodeAst;
      input?: InputAst;
    };

export interface ResolveReferenceTypeParams {
  reference: string;
  graph?: GraphAst;
  inputs?: InputAst[];
  nodes?: NodeAst[];
}

export function parseReference(reference: string): ParsedReference {
  const normalized = reference.trim();
  const [root = "", ...path] = normalized
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    root,
    path,
    raw: normalized,
  };
}

export function resolveReferenceType(params: ResolveReferenceTypeParams): ReferenceResolution {
  const reference = parseReference(params.reference);
  const inputs = params.inputs ?? params.graph?.inputs ?? [];
  const nodes = params.nodes ?? params.graph?.nodes ?? [];
  const input = inputs.find((candidate) => candidate.name === reference.root);

  if (input) {
    if (reference.path.length > 0) {
      return {
        ok: false,
        reference,
        code: DiagnosticCodes.INVALID_REFERENCE_PROPERTY,
        reason: "missing-property",
        message: `A propriedade "${reference.path.join(".")}" nao existe na referencia "${reference.raw}".`,
        input,
      };
    }

    return {
      ok: true,
      reference,
      type: parseMomomType(input.type),
      sourceKind: "input",
      input,
    };
  }

  const node = nodes.find((candidate) => candidate.id === reference.root);
  if (!node) {
    return {
      ok: false,
      reference,
      code: DiagnosticCodes.MISSING_REFERENCE,
      reason: "missing-reference",
      message: `A referencia "${reference.raw}" nao existe.`,
    };
  }

  const nodeDefinition = getNodeDefinition(node.type);
  if (!nodeDefinition) {
    return {
      ok: false,
      reference,
      code: DiagnosticCodes.UNRESOLVED_TYPE,
      reason: "unresolved-type",
      message: `Nao foi possivel resolver o tipo da referencia "${reference.raw}".`,
      node,
    };
  }

  const outputEntries = Object.entries(nodeDefinition.outputs);
  if (reference.path.length === 0) {
    if (outputEntries.length === 1) {
      return {
        ok: true,
        reference,
        type: parseMomomType(outputEntries[0][1]),
        sourceKind: "node-output",
        node,
      };
    }

    return {
      ok: false,
      reference,
      code: DiagnosticCodes.UNRESOLVED_TYPE,
      reason: "unresolved-type",
      message: `Nao foi possivel resolver o tipo da referencia "${reference.raw}".`,
      node,
    };
  }

  const [property, ...restPath] = reference.path;
  const outputType = nodeDefinition.outputs[property];
  if (!outputType) {
    return {
      ok: false,
      reference,
      code: DiagnosticCodes.INVALID_REFERENCE_PROPERTY,
      reason: "missing-property",
      message: `A propriedade "${property}" nao existe na referencia "${reference.raw}".`,
      node,
    };
  }

  if (restPath.length > 0) {
    return {
      ok: false,
      reference,
      code: DiagnosticCodes.INVALID_REFERENCE_PROPERTY,
      reason: "missing-property",
      message: `A propriedade "${reference.path.join(".")}" nao existe na referencia "${reference.raw}".`,
      node,
    };
  }

  return {
    ok: true,
    reference,
    type: parseMomomType(outputType),
    sourceKind: "node-output",
    node,
  };
}
