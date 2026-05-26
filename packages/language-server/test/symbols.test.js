import { describe, expect, it } from "vitest";
import { getDocumentSymbols } from "../dist/symbols.js";
import { createDocument } from "./helpers.js";

describe("symbols", () => {
  it("includes grouped outline sections", () => {
    const document = createDocument(`graph HelloUser {
  input name: string

  node greeting: Text.Template {
    template: "Hello, {name}"
  }

  edge name -> greeting.name
  output message: greeting.text
}`);
    const symbols = getDocumentSymbols(document);
    const groupNames = symbols[0].children?.map((symbol) => symbol.name) ?? [];

    expect(groupNames).toEqual(expect.arrayContaining(["Inputs", "Nodes", "Edges", "Outputs"]));
  });

  it("includes node outputs in outline", () => {
    const document = createDocument(`graph HelloUser {
  input name: string

  node greeting: Text.Template {
    template: "Hello, {name}"
  }
}`);
    const symbols = getDocumentSymbols(document);
    const nodesGroup = symbols[0].children?.find((symbol) => symbol.name === "Nodes");
    const greetingSymbol = nodesGroup?.children?.find((symbol) => symbol.name === "greeting: Text.Template");

    expect(greetingSymbol?.children?.map((symbol) => symbol.name)).toContain("text: string");
  });
});
