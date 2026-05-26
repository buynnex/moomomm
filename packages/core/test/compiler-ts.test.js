import { describe, expect, it } from "vitest";
import { CompilerDiagnosticError, compileGraphToTypeScript, compileToTypeScript } from "../dist/compiler-ts.js";
import { buildIR } from "../dist/ir.js";
import { parseGraph } from "../dist/parser.js";
import { DiagnosticCodes } from "../dist/diagnostics.js";
import { readExample, readInvalidExample } from "./helpers.js";

describe("compiler-ts", () => {
  it("compiler-ts gera funcao HelloUser", () => {
    const graph = parseGraph(readExample("hello.momom"));
    const output = compileToTypeScript(buildIR(graph));

    expect(output).toContain("export function HelloUser(input: HelloUserInput): HelloUserOutput");
    expect(output).toContain("const greeting = {");
    expect(output).toContain("return {");
  });

  it("compiler-ts gera template string corretamente para HelloUser", () => {
    const graph = parseGraph(readExample("hello.momom"));
    const output = compileToTypeScript(buildIR(graph));

    expect(output).toContain("text: `");
    expect(output).toContain("${input.name}");
    expect(output).toContain("message: greeting.text");
  });

  it("gera aliases para User, Token e Product", () => {
    const output = compileToTypeScript(buildIR(parseGraph(readExample("auth_recommend.momom"))));

    expect(output).toContain("export type User = unknown;");
    expect(output).toContain("export type Token = unknown;");
    expect(output).toContain("export type Product = unknown;");
  });

  it("compila AuthRecommend com placeholders seguros", () => {
    const output = compileToTypeScript(buildIR(parseGraph(readExample("auth_recommend.momom"))));

    expect(output).toContain("// TODO: Auth.VerifyToken placeholder seguro.");
    expect(output).toContain("valid: Boolean(input.token)");
    expect(output).toContain("// TODO: ML.RecommendProducts placeholder seguro.");
    expect(output).toContain("items: input.products.slice(0, 5)");
    expect(output).toContain("// TODO: Action.TriggerAnomaly placeholder seguro.");
    expect(output).toContain("triggered: true");
  });

  it("nao usa eval nem Function constructor", () => {
    const output = compileToTypeScript(buildIR(parseGraph(readExample("auth_recommend.momom"))));

    expect(output).not.toContain("eval(");
    expect(output).not.toContain("Function(");
    expect(output).not.toContain("new Function");
  });

  it("gera Product[] no output result", () => {
    const output = compileToTypeScript(buildIR(parseGraph(readExample("auth_recommend.momom"))));

    expect(output).toContain("export type AuthRecommendOutput = {");
    expect(output).toContain("result: Product[];");
  });

  it("compila CustomerOffer com template string correto", () => {
    const output = compileToTypeScript(buildIR(parseGraph(readExample("customer_offer.momom"))));

    expect(output).toContain("export function CustomerOffer(input: CustomerOfferInput): CustomerOfferOutput");
    expect(output).toContain("${input.customerName}");
    expect(output).toContain("${input.offerValue}");
    expect(output).toContain("${input.productName}");
    expect(output).toContain("text: message.text");
  });

  it("compiler falha de forma controlada quando output property nao existe", () => {
    const graph = parseGraph(readInvalidExample("missing_output_property.momom"));

    expect(() => compileGraphToTypeScript(graph)).toThrow(CompilerDiagnosticError);

    try {
      compileGraphToTypeScript(graph);
    } catch (error) {
      expect(error).toBeInstanceOf(CompilerDiagnosticError);
      expect(error.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
        DiagnosticCodes.INVALID_REFERENCE_PROPERTY,
      );
    }
  });
});
