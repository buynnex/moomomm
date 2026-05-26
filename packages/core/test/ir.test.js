import { describe, expect, it } from "vitest";
import { buildIR } from "../dist/ir.js";
import { parseGraph } from "../dist/parser.js";
import { readExample } from "./helpers.js";

describe("ir", () => {
  it('buildIR gera version "0.4"', () => {
    const ir = buildIR(parseGraph(readExample("hello.momom")));
    expect(ir.version).toBe("0.4");
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

  it("IR inclui nodes.inputs resolvidos", () => {
    const ir = buildIR(parseGraph(readExample("auth_recommend.momom")));
    expect(ir.nodes.find((node) => node.id === "verify")?.inputs).toMatchObject({
      token: {
        source: "token",
        type: "Token",
        inferred: true,
      },
    });
  });

  it("IR inclui edges.fromType e edges.toPort", () => {
    const ir = buildIR(parseGraph(readExample("auth_recommend.momom")));
    expect(ir.edges).toContainEqual(
      expect.objectContaining({
        from: "token",
        fromType: "Token",
        toNode: "verify",
        toPort: "token",
      }),
    );
  });

  it("IR inclui executionPlan", () => {
    const ir = buildIR(parseGraph(readExample("auth_recommend.momom")));
    expect(ir.executionPlan).toHaveLength(3);
    expect(ir.executionPlan.map((item) => item.nodeId)).toEqual(expect.arrayContaining(["verify", "recommend", "block"]));
  });

  it("node Auth.VerifyToken inclui outputs.valid boolean", () => {
    const ir = buildIR(parseGraph(readExample("auth_recommend.momom")));
    expect(ir.nodes.find((node) => node.id === "verify")?.outputs.valid).toBe("boolean");
  });

  it("node ML.RecommendProducts inclui outputs.items Product[]", () => {
    const ir = buildIR(parseGraph(readExample("auth_recommend.momom")));
    expect(ir.nodes.find((node) => node.id === "recommend")?.outputs.items).toBe("Product[]");
  });

  it("output result continua com Product[]", () => {
    const ir = buildIR(parseGraph(readExample("auth_recommend.momom")));
    expect(ir.outputs.find((output) => output.name === "result")?.type).toBe("Product[]");
  });
});
