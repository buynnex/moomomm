import { describe, expect, it } from "vitest";
import { getCompletionItems } from "../dist/completion.js";
import { createDocument, positionAfter } from "./helpers.js";

describe("completion", () => {
  it("suggests top-level statements", () => {
    const document = createDocument("graph Hello {\n  \n}");
    const labels = getCompletionItems(document, { line: 1, character: 2 }).map((item) => item.label);

    expect(labels).toEqual(expect.arrayContaining(["input", "node", "edge", "branch", "output"]));
  });

  it("suggests input types", () => {
    const document = createDocument("graph Hello {\n  input name: \n}");
    const labels = getCompletionItems(document, { line: 1, character: "  input name: ".length }).map((item) => item.label);

    expect(labels).toEqual(expect.arrayContaining(["string", "number", "boolean", "User", "Token", "Product[]"]));
  });

  it("suggests known node types", () => {
    const document = createDocument("graph Hello {\n  node greeting: \n}");
    const labels = getCompletionItems(document, { line: 1, character: "  node greeting: ".length }).map((item) => item.label);

    expect(labels).toEqual(
      expect.arrayContaining(["Text.Template", "Auth.VerifyToken", "ML.RecommendProducts", "Action.TriggerAnomaly"]),
    );
  });

  it("suggests verify ports after target dot", () => {
    const document = createDocument(`graph AuthRecommend {
  input token: Token
  input user: User

  node verify: Auth.VerifyToken {
    deterministic: true
  }

  edge token -> verify.
}`);
    const labels = getCompletionItems(document, positionAfter(document, "edge token -> verify.")).map((item) => item.label);

    expect(labels).toEqual(expect.arrayContaining(["token", "user"]));
  });

  it("suggests node output properties", () => {
    const document = createDocument(`graph HelloUser {
  input name: string

  node greeting: Text.Template {
    template: "Hello, {name}"
  }

  output message: greeting.
}`);
    const labels = getCompletionItems(document, positionAfter(document, "output message: greeting.")).map((item) => item.label);

    expect(labels).toContain("text");
  });

  it("suggests boolean branch sources", () => {
    const document = createDocument(`graph AuthRecommend {
  input token: Token

  node verify: Auth.VerifyToken {
    deterministic: true
  }

  branch verify.
}`);
    const labels = getCompletionItems(document, positionAfter(document, "branch verify.")).map((item) => item.label);

    expect(labels).toContain("verify.valid");
  });
});
