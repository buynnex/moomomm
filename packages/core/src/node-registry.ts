export type RiskLevel = "low" | "medium" | "high" | "critical";
export type NodeCategory = "text" | "auth" | "ml" | "action";
export type NodeCompileStrategy =
  | "template"
  | "placeholder-auth"
  | "placeholder-recommend"
  | "placeholder-action";

export interface NodeDefinition {
  type: string;
  category: NodeCategory;
  deterministic: boolean;
  outputs: Record<string, string>;
  compileStrategy: NodeCompileStrategy;
  requiredInputs?: string[];
  optionalInputs?: string[];
  effects?: string[];
  riskDefault?: RiskLevel;
}

const NODE_REGISTRY: Record<string, NodeDefinition> = {
  "Text.Template": {
    type: "Text.Template",
    category: "text",
    deterministic: true,
    outputs: {
      text: "string",
    },
    compileStrategy: "template",
  },
  "Auth.VerifyToken": {
    type: "Auth.VerifyToken",
    category: "auth",
    deterministic: true,
    outputs: {
      valid: "boolean",
    },
    compileStrategy: "placeholder-auth",
    optionalInputs: ["token", "user"],
    riskDefault: "critical",
  },
  "ML.RecommendProducts": {
    type: "ML.RecommendProducts",
    category: "ml",
    deterministic: false,
    outputs: {
      items: "Product[]",
    },
    compileStrategy: "placeholder-recommend",
    optionalInputs: ["products", "user"],
    riskDefault: "medium",
  },
  "Action.TriggerAnomaly": {
    type: "Action.TriggerAnomaly",
    category: "action",
    deterministic: true,
    outputs: {
      triggered: "boolean",
    },
    compileStrategy: "placeholder-action",
    effects: ["anomaly-trigger"],
    riskDefault: "high",
  },
};

export const VALID_RISK_LEVELS: readonly RiskLevel[] = ["low", "medium", "high", "critical"];

export function getNodeDefinition(nodeType: string): NodeDefinition | undefined {
  return NODE_REGISTRY[nodeType];
}

export function getNodeOutputType(nodeType: string, outputName: string): string | undefined {
  return getNodeDefinition(nodeType)?.outputs[outputName];
}

export function listKnownNodes(): NodeDefinition[] {
  return Object.values(NODE_REGISTRY);
}

export function isRiskLevel(value: string): value is RiskLevel {
  return VALID_RISK_LEVELS.includes(value as RiskLevel);
}
