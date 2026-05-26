import { describe, expect, it } from "vitest";
import { buildIR } from "../dist/ir.js";
import { parseGraph } from "../dist/parser.js";
import { readExample } from "./helpers.js";

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
        intent: expect.any(String),
        template: expect.any(String),
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

  it("buildIR gera kind momom.graph e version 0.3", () => {
    const ir = buildIR(parseGraph(readExample("hello.momom")));

    expect(ir.kind).toBe("momom.graph");
    expect(ir.version).toBe("0.3");
    expect(ir.nodes[0]).toMatchObject({
      id: "greeting",
      type: "Text.Template",
      intent: expect.any(String),
      outputs: {
        text: "string",
      },
      properties: {
        template: expect.any(String),
      },
    });
  });
});
