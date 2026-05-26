import type { NodeAst } from "./ast.js";

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type NodeCategory = "text" | "auth" | "ml" | "action";
export type NodeCompileStrategy =
  | "template"
  | "placeholder-auth"
  | "placeholder-recommend"
  | "placeholder-action";
export type NodePropertyType = "string" | "number" | "boolean";

export interface NodeInputContract {
  name: string;
  types: string[];
  required: boolean;
  description?: string;
}

export interface NodePropertyContract {
  name: string;
  type: NodePropertyType;
  required: boolean;
}

export interface NodeContract {
  type: string;
  category: NodeCategory;
  deterministic: boolean;
  inputs: NodeInputContract[];
  outputs: Record<string, string>;
  properties?: NodePropertyContract[];
  compileStrategy: NodeCompileStrategy;
  effects?: string[];
  riskDefault?: RiskLevel;
  dynamicInputsStrategy?: "template-variables";
}

export interface ResolvedNodeContract extends Omit<NodeContract, "inputs" | "properties"> {
  inputs: NodeInputContract[];
  properties: NodePropertyContract[];
}

const NODE_REGISTRY: Record<string, NodeContract> = {
  "Text.Template": {
    type: "Text.Template",
    category: "text",
    deterministic: true,
    inputs: [],
    outputs: {
      text: "string",
    },
    properties: [
      { name: "template", type: "string", required: true },
      { name: "intent", type: "string", required: false },
    ],
    compileStrategy: "template",
    effects: [],
    dynamicInputsStrategy: "template-variables",
  },
  "Auth.VerifyToken": {
    type: "Auth.VerifyToken",
    category: "auth",
    deterministic: true,
    inputs: [
      { name: "token", types: ["Token", "string", "unknown"], required: true },
      { name: "user", types: ["User", "unknown"], required: false },
    ],
    outputs: {
      valid: "boolean",
    },
    properties: [
      { name: "intent", type: "string", required: false },
      { name: "risk", type: "string", required: false },
      { name: "deterministic", type: "boolean", required: false },
    ],
    compileStrategy: "placeholder-auth",
    effects: [],
    riskDefault: "critical",
  },
  "ML.RecommendProducts": {
    type: "ML.RecommendProducts",
    category: "ml",
    deterministic: false,
    inputs: [
      { name: "products", types: ["Product[]"], required: true },
      { name: "user", types: ["User", "unknown"], required: false },
    ],
    outputs: {
      items: "Product[]",
    },
    properties: [
      { name: "topK", type: "number", required: false },
      { name: "intent", type: "string", required: false },
      { name: "risk", type: "string", required: false },
      { name: "deterministic", type: "boolean", required: false },
    ],
    compileStrategy: "placeholder-recommend",
    effects: [],
    riskDefault: "medium",
  },
  "Action.TriggerAnomaly": {
    type: "Action.TriggerAnomaly",
    category: "action",
    deterministic: true,
    inputs: [{ name: "reason", types: ["string"], required: false }],
    outputs: {
      triggered: "boolean",
    },
    properties: [
      { name: "intent", type: "string", required: false },
      { name: "risk", type: "string", required: false },
      { name: "deterministic", type: "boolean", required: false },
    ],
    compileStrategy: "placeholder-action",
    effects: ["event"],
    riskDefault: "high",
  },
};

export const VALID_RISK_LEVELS: readonly RiskLevel[] = ["low", "medium", "high", "critical"];

export function getNodeDefinition(nodeType: string): NodeContract | undefined {
  return NODE_REGISTRY[nodeType];
}

export function resolveNodeContract(node: Pick<NodeAst, "type" | "properties">): ResolvedNodeContract | undefined {
  const contract = getNodeDefinition(node.type);
  if (!contract) {
    return undefined;
  }

  return {
    ...contract,
    inputs: resolveNodeInputContracts(node),
    properties: [...(contract.properties ?? [])],
  };
}

export function resolveNodeInputContracts(node: Pick<NodeAst, "type" | "properties">): NodeInputContract[] {
  const contract = getNodeDefinition(node.type);
  if (!contract) {
    return [];
  }

  if (contract.dynamicInputsStrategy === "template-variables") {
    const template = typeof node.properties.template === "string" ? node.properties.template : "";
    return extractTemplateVariables(template).map((name) => ({
      name,
      types: ["string", "number", "boolean"],
      required: true,
    }));
  }

  return contract.inputs.map((inputContract) => ({
    ...inputContract,
    types: [...inputContract.types],
  }));
}

export function getNodeOutputType(nodeType: string, outputName: string): string | undefined {
  return getNodeDefinition(nodeType)?.outputs[outputName];
}

export function listKnownNodes(): NodeContract[] {
  return Object.values(NODE_REGISTRY).map((definition) => ({
    ...definition,
    inputs: definition.inputs.map((inputContract) => ({
      ...inputContract,
      types: [...inputContract.types],
    })),
    properties: definition.properties ? [...definition.properties] : undefined,
    outputs: { ...definition.outputs },
    effects: definition.effects ? [...definition.effects] : undefined,
  }));
}

export function isRiskLevel(value: string): value is RiskLevel {
  return VALID_RISK_LEVELS.includes(value as RiskLevel);
}

export function extractTemplateVariables(template: string): string[] {
  const pattern = /\{([^{}]+)\}/g;
  const variables = new Set<string>();
  let match = pattern.exec(template);

  while (match) {
    const variableName = match[1].trim();
    if (variableName) {
      variables.add(variableName);
    }
    match = pattern.exec(template);
  }

  pattern.lastIndex = 0;
  return [...variables];
}
