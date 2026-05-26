import { describe, expect, it } from "vitest";
import { getDefinition } from "../dist/definition.js";
import { createDocument, positionAfter } from "./helpers.js";

describe("definition", () => {
  it("resolves edge source input definitions", () => {
    const document = createDocument(`graph HelloUser {
  input name: string

  node greeting: Text.Template {
    template: "Hello, {name}"
  }

  edge name -> greeting.name
}`);
    const definition = getDefinition(document, positionAfter(document, "edge ", 1));

    expect(definition?.range.start.line).toBe(1);
  });

  it("resolves edge target node definitions", () => {
    const document = createDocument(`graph HelloUser {
  input name: string

  node greeting: Text.Template {
    template: "Hello, {name}"
  }

  edge name -> greeting.name
}`);
    const definition = getDefinition(document, positionAfter(document, "edge name -> ", 2));

    expect(definition?.range.start.line).toBe(3);
  });

  it("resolves output references back to the node", () => {
    const document = createDocument(`graph HelloUser {
  input name: string

  node greeting: Text.Template {
    template: "Hello, {name}"
  }

  output message: greeting.text
}`);
    const definition = getDefinition(document, positionAfter(document, "output message: ", 2));

    expect(definition?.range.start.line).toBe(3);
  });
});
