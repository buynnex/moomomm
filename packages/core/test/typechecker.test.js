import { describe, expect, it } from "vitest";
import { DiagnosticCodes } from "../dist/diagnostics.js";
import { parseGraph } from "../dist/parser.js";
import { typeCheckGraph } from "../dist/typechecker.js";
import { validateGraph } from "../dist/validator.js";
import { readExample, readInvalidExample } from "./helpers.js";

describe("typechecker", () => {
  it("HelloUser sem erros", () => {
    expect(typeCheckGraph(parseGraph(readExample("hello.momom")))).toEqual([]);
  });

  it("AuthRecommend sem erros", () => {
    expect(typeCheckGraph(parseGraph(readExample("auth_recommend.momom")))).toEqual([]);
  });

  it("CustomerOffer sem erros", () => {
    expect(typeCheckGraph(parseGraph(readExample("customer_offer.momom")))).toEqual([]);
  });

  it("output reference inexistente gera MOMOM009", () => {
    const diagnostics = typeCheckGraph(parseGraph(readInvalidExample("missing_output_reference.momom")));
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(DiagnosticCodes.MISSING_REFERENCE);
  });

  it("output property inexistente gera MOMOM013", () => {
    const diagnostics = typeCheckGraph(parseGraph(readInvalidExample("missing_output_property.momom")));
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      DiagnosticCodes.INVALID_REFERENCE_PROPERTY,
    );
  });

  it("branch non-boolean gera MOMOM014", () => {
    const diagnostics = typeCheckGraph(parseGraph(readInvalidExample("branch_non_boolean.momom")));
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(DiagnosticCodes.BRANCH_NOT_BOOLEAN);
  });

  it("template variable inexistente gera MOMOM015", () => {
    const diagnostics = typeCheckGraph(parseGraph(readInvalidExample("template_missing_variable.momom")));
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      DiagnosticCodes.TEMPLATE_VARIABLE_MISSING,
    );
  });

  it("template variable tipo incompatível gera MOMOM016", () => {
    const diagnostics = typeCheckGraph(parseGraph(readInvalidExample("template_incompatible_type.momom")));
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      DiagnosticCodes.TEMPLATE_VARIABLE_INCOMPATIBLE,
    );
  });

  it("cycle continua gerando MOMOM010", () => {
    const diagnostics = validateGraph(parseGraph(readInvalidExample("cycle_simple.momom"))).diagnostics;
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(DiagnosticCodes.GRAPH_CYCLE);
  });

  it("critical deterministic false continua gerando MOMOM007", () => {
    const diagnostics = validateGraph(parseGraph(readInvalidExample("critical_probabilistic.momom"))).diagnostics;
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      DiagnosticCodes.CRITICAL_NODE_PROBABILISTIC,
    );
  });
});
