import { describe, expect, it } from "vitest";
import { DiagnosticCodes } from "../dist/diagnostics.js";
import { resolveReferenceType, parseReference } from "../dist/references.js";
import { parseGraph } from "../dist/parser.js";
import { readExample, readInvalidExample } from "./helpers.js";

describe("references", () => {
  it('parseReference("name")', () => {
    expect(parseReference("name")).toEqual({
      root: "name",
      path: [],
      raw: "name",
    });
  });

  it('parseReference("recommend.items")', () => {
    expect(parseReference("recommend.items")).toEqual({
      root: "recommend",
      path: ["items"],
      raw: "recommend.items",
    });
  });

  it("resolve input name:string", () => {
    const graph = parseGraph(readExample("hello.momom"));
    const resolution = resolveReferenceType({ reference: "name", graph });

    expect(resolution.ok).toBe(true);
    if (resolution.ok) {
      expect(resolution.type.raw).toBe("string");
    }
  });

  it("resolve greeting.text:string", () => {
    const graph = parseGraph(readExample("hello.momom"));
    const resolution = resolveReferenceType({ reference: "greeting.text", graph });

    expect(resolution.ok).toBe(true);
    if (resolution.ok) {
      expect(resolution.type.raw).toBe("string");
    }
  });

  it("resolve verify.valid:boolean", () => {
    const graph = parseGraph(readExample("auth_recommend.momom"));
    const resolution = resolveReferenceType({ reference: "verify.valid", graph });

    expect(resolution.ok).toBe(true);
    if (resolution.ok) {
      expect(resolution.type.raw).toBe("boolean");
    }
  });

  it("resolve recommend.items:Product[]", () => {
    const graph = parseGraph(readExample("auth_recommend.momom"));
    const resolution = resolveReferenceType({ reference: "recommend.items", graph });

    expect(resolution.ok).toBe(true);
    if (resolution.ok) {
      expect(resolution.type.raw).toBe("Product[]");
    }
  });

  it("erro em propriedade inexistente", () => {
    const graph = parseGraph(readInvalidExample("missing_output_property.momom"));
    const resolution = resolveReferenceType({ reference: "greeting.invalidField", graph });

    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.code).toBe(DiagnosticCodes.INVALID_REFERENCE_PROPERTY);
    }
  });
});
