import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseGraph } from "../src/parser.js";

function readExample(fileName: string): string {
  return readFileSync(new URL(`../../../examples/${fileName}`, import.meta.url), "utf8");
}

describe("parser", () => {
  it("parser le HelloUser corretamente", () => {
    const graph = parseGraph(readExample("hello.momom"));

    expect(graph.name).toBe("HelloUser");
    expect(graph.inputs).toEqual([{ kind: "Input", name: "name", type: "string", loc: expect.any(Object) }]);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0]).toMatchObject({
      id: "greeting",
      type: "Text.Template",
      properties: {
        intent: "Criar mensagem de boas-vindas",
        template: "Olá, {name}",
      },
    });
    expect(graph.outputs[0]).toMatchObject({
      name: "message",
      reference: "greeting.text",
    });
  });

  it("parser le AuthRecommend corretamente", () => {
    const graph = parseGraph(readExample("auth_recommend.momom"));

    expect(graph.name).toBe("AuthRecommend");
    expect(graph.inputs).toHaveLength(3);
    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(4);
    expect(graph.branches).toEqual([
      {
        kind: "Branch",
        source: "verify.valid",
        cases: [
          { value: "true", target: "recommend", loc: expect.any(Object) },
          { value: "false", target: "block", loc: expect.any(Object) },
        ],
        loc: expect.any(Object),
      },
    ]);
    expect(graph.outputs[0]).toMatchObject({
      name: "result",
      reference: "recommend.items",
    });
  });
});
