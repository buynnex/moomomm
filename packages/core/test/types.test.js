import { describe, expect, it } from "vitest";
import { areTypesCompatible, parseMomomType } from "../dist/types.js";

describe("types", () => {
  it('parseMomomType("string")', () => {
    expect(parseMomomType("string")).toEqual({
      name: "string",
      isArray: false,
      raw: "string",
    });
  });

  it('parseMomomType("Product[]")', () => {
    expect(parseMomomType("Product[]")).toEqual({
      name: "Product",
      isArray: true,
      raw: "Product[]",
    });
  });

  it("compatibilidade string/string", () => {
    expect(areTypesCompatible(parseMomomType("string"), parseMomomType("string"))).toBe(true);
  });

  it("incompatibilidade string/number", () => {
    expect(areTypesCompatible(parseMomomType("string"), parseMomomType("number"))).toBe(false);
  });

  it("incompatibilidade Product/Product[]", () => {
    expect(areTypesCompatible(parseMomomType("Product"), parseMomomType("Product[]"))).toBe(false);
  });

  it("any compativel com tudo", () => {
    expect(areTypesCompatible(parseMomomType("any"), parseMomomType("Product[]"))).toBe(true);
    expect(areTypesCompatible(parseMomomType("string"), parseMomomType("any"))).toBe(true);
  });
});
