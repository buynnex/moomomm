import { describe, expect, it } from "vitest";
import { DiagnosticCodes } from "../dist/diagnostics.js";
import { parseGraph } from "../dist/parser.js";
import { validateGraph } from "../dist/validator.js";
import { readExample, readInvalidExample } from "./helpers.js";

describe("validator", () => {
  it("validator aceita HelloUser", () => {
    const result = validateGraph(parseGraph(readExample("hello.momom")));
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it("validator aceita AuthRecommend", () => {
    const result = validateGraph(parseGraph(readExample("auth_recommend.momom")));
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it("validator aceita CustomerOffer", () => {
    const result = validateGraph(parseGraph(readExample("customer_offer.momom")));
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it("validator rejeita node critical com deterministic false", () => {
    const result = validateGraph(parseGraph(readInvalidExample("critical_probabilistic.momom")));
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

  it("validator rejeita branch source com node inexistente", () => {
    const source = `graph BrokenBranch {
  node verify: Auth.VerifyToken {
    deterministic: true
  }

  branch login.valid {
    true -> verify
  }
}`;

    const result = validateGraph(parseGraph(source));
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      DiagnosticCodes.MISSING_REFERENCE,
    );
  });

  it("validator rejeita output reference inexistente", () => {
    const result = validateGraph(parseGraph(readInvalidExample("missing_output_reference.momom")));
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      DiagnosticCodes.MISSING_REFERENCE,
    );
  });

  it("validator rejeita ciclo simples", () => {
    const result = validateGraph(parseGraph(readInvalidExample("cycle_simple.momom")));
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      DiagnosticCodes.GRAPH_CYCLE,
    );
  });

  it("validator rejeita risk invalido", () => {
    const source = `graph InvalidRisk {
  node risky: Action.TriggerAnomaly {
    risk: "urgent"
  }
}`;

    const result = validateGraph(parseGraph(source));
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      DiagnosticCodes.INVALID_RISK,
    );
  });

  it("validator rejeita deterministic nao booleano", () => {
    const source = `graph InvalidDeterministic {
  node risky: Action.TriggerAnomaly {
    deterministic: "sometimes"
  }
}`;

    const result = validateGraph(parseGraph(source));
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      DiagnosticCodes.INVALID_DETERMINISTIC,
    );
  });
});
