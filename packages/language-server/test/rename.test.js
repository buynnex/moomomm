import { describe, expect, it } from "vitest";
import { getRenameWorkspaceEdit, prepareRename } from "../dist/rename.js";
import { createDocument, positionAtText } from "./helpers.js";

describe("rename", () => {
  it("prepareRename accepts input identifiers", () => {
    const document = createDocument("graph Hello {\n  input name: string\n}");
    const result = prepareRename(document, positionAtText(document, "input name", 7));

    expect(result).not.toBeNull();
  });

  it("prepareRename accepts node identifiers", () => {
    const document = createDocument(`graph Hello {
  node greeting: Text.Template {
    template: "Hello"
  }
}`);
    const result = prepareRename(document, positionAtText(document, "node greeting", 6));

    expect(result).not.toBeNull();
  });

  it("prepareRename rejects keywords", () => {
    const document = createDocument("graph Hello {\n}");
    const result = prepareRename(document, positionAtText(document, "graph", 1));

    expect(result).toBeNull();
  });

  it("renames inputs across declaration, edge and template", () => {
    const document = createDocument(`graph HelloUser {
  input name: string

  node greeting: Text.Template {
    template: "Hello, {name}"
  }

  edge name -> greeting.name
}`);
    const edit = getRenameWorkspaceEdit(document, positionAtText(document, "input name", 7), "customerName");
    const changes = edit?.changes?.[document.uri] ?? [];

    expect(changes).toHaveLength(3);
    expect(changes.every((change) => change.newText === "customerName")).toBe(true);
  });

  it("renames nodes across declaration, edge and output", () => {
    const document = createDocument(`graph HelloUser {
  input name: string

  node greeting: Text.Template {
    template: "Hello, {name}"
  }

  edge name -> greeting.name
  output message: greeting.text
}`);
    const edit = getRenameWorkspaceEdit(document, positionAtText(document, "node greeting", 6), "welcome");
    const changes = edit?.changes?.[document.uri] ?? [];

    expect(changes).toHaveLength(3);
    expect(changes.every((change) => change.newText === "welcome")).toBe(true);
  });
});
