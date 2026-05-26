import { describe, expect, it } from "vitest";
import { getReferences } from "../dist/references.js";
import { createDocument, positionAtText } from "./helpers.js";

describe("references", () => {
  it("finds input references across declaration, edge and template", () => {
    const document = createDocument(`graph HelloUser {
  input name: string

  node greeting: Text.Template {
    template: "Hello, {name}"
  }

  edge name -> greeting.name
  output message: greeting.text
}`);
    const references = getReferences(document, positionAtText(document, "input name", 7), true);

    expect(references).toHaveLength(3);
  });

  it("finds node references across declaration, edge and output", () => {
    const document = createDocument(`graph HelloUser {
  input name: string

  node greeting: Text.Template {
    template: "Hello, {name}"
  }

  edge name -> greeting.name
  output message: greeting.text
}`);
    const references = getReferences(document, positionAtText(document, "node greeting", 6), true);

    expect(references).toHaveLength(3);
  });
});
