import { describe, expect, it } from "vitest";
import { buildIR } from "../dist/ir.js";
import { parseGraph } from "../dist/parser.js";
import { readExample } from "./helpers.js";

describe("ir", () => {
  it('buildIR gera version "0.3"', () => {
    const ir = buildIR(parseGraph(readExample("hello.momom")));
    expect(ir.version).toBe("0.3");
  });

  it('output message inclui type "string"', () => {
    const ir = buildIR(parseGraph(readExample("hello.momom")));
    expect(ir.outputs[0]).toMatchObject({
      name: "message",
      type: "string",
    });
  });

  it("node Text.Template inclui outputs.text string", () => {
    const ir = buildIR(parseGraph(readExample("hello.momom")));
    expect(ir.nodes[0].outputs.text).toBe("string");
  });

  it("node Auth.VerifyToken inclui outputs.valid boolean", () => {
    const ir = buildIR(parseGraph(readExample("auth_recommend.momom")));
    expect(ir.nodes.find((node) => node.id === "verify")?.outputs.valid).toBe("boolean");
  });

  it("node ML.RecommendProducts inclui outputs.items Product[]", () => {
    const ir = buildIR(parseGraph(readExample("auth_recommend.momom")));
    expect(ir.nodes.find((node) => node.id === "recommend")?.outputs.items).toBe("Product[]");
  });
});
