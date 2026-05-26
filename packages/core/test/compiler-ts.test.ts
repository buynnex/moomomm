import { describe, expect, it } from "vitest";
import { compileToTypeScript } from "../src/compiler-ts.js";
import { buildIR } from "../src/ir.js";
import { parseGraph } from "../src/parser.js";

const helloSource = `graph HelloUser {
  input name: string

  node greeting: Text.Template {
    intent: "Criar mensagem de boas-vindas"
    template: "Olá, {name}"
  }

  edge name -> greeting

  output message: greeting.text
}`;

describe("compiler-ts", () => {
  it("compiler-ts gera funcao HelloUser", () => {
    const graph = parseGraph(helloSource);
    const output = compileToTypeScript(buildIR(graph));

    expect(output).toContain("export function HelloUser(input: HelloUserInput): HelloUserOutput");
    expect(output).toContain("const greeting = {");
    expect(output).toContain("return {");
  });

  it("compiler-ts gera template string corretamente", () => {
    const graph = parseGraph(helloSource);
    const output = compileToTypeScript(buildIR(graph));

    expect(output).toContain("text: `Olá, ${input.name}`");
    expect(output).toContain("message: greeting.text");
  });
});
