import { describe, expect, it } from "vitest";
import { DiagnosticCodes } from "../src/diagnostics.js";
import { parseGraph } from "../src/parser.js";
import { validateGraph } from "../src/validator.js";

const helloSource = `graph HelloUser {
  input name: string

  node greeting: Text.Template {
    intent: "Criar mensagem de boas-vindas"
    template: "Olá, {name}"
  }

  edge name -> greeting

  output message: greeting.text
}`;

const authSource = `graph AuthRecommend {
  input user: User
  input token: Token
  input products: Product[]

  node verify: Auth.VerifyToken {
    intent: "Verificar token do usuário"
    risk: "critical"
    deterministic: true
  }

  node recommend: ML.RecommendProducts {
    intent: "Recomendar produtos com base no histórico"
    risk: "medium"
    deterministic: false
    topK: 5
  }

  node block: Action.TriggerAnomaly {
    intent: "Bloquear fluxo por possível anomalia"
    risk: "high"
    deterministic: true
  }

  edge user -> verify
  edge token -> verify
  edge user -> recommend
  edge products -> recommend

  branch verify.valid {
    true -> recommend
    false -> block
  }

  output result: recommend.items
}`;

describe("validator", () => {
  it("validator aceita HelloUser", () => {
    const result = validateGraph(parseGraph(helloSource));
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it("validator aceita AuthRecommend", () => {
    const result = validateGraph(parseGraph(authSource));
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it("validator rejeita node critical com deterministic false", () => {
    const source = `graph UnsafeFlow {
  node risky: Security.Decision {
    risk: "critical"
    deterministic: false
  }
}`;

    const result = validateGraph(parseGraph(source));
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      DiagnosticCodes.CRITICAL_NODE_PROBABILISTIC,
    );
  });

  it("validator rejeita edge para node inexistente", () => {
    const source = `graph BrokenEdge {
  input name: string
  edge name -> missingNode
}`;

    const result = validateGraph(parseGraph(source));
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      DiagnosticCodes.MISSING_REFERENCE,
    );
  });
});
