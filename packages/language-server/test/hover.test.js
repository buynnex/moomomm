import { describe, expect, it } from "vitest";
import { getHover } from "../dist/hover.js";
import { createDocument, positionAtText } from "./helpers.js";

describe("hover", () => {
  it("shows outputs for Text.Template", () => {
    const document = createDocument(`graph HelloUser {
  input name: string

  node greeting: Text.Template {
    template: "Hello, {name}"
  }
}`);
    const hover = getHover(document, positionAtText(document, "Text.Template", 2));

    expect(hover && "value" in hover.contents ? hover.contents.value : "").toContain("text: string");
  });

  it("shows inputs and outputs for Auth.VerifyToken", () => {
    const document = createDocument(`graph AuthRecommend {
  input token: Token

  node verify: Auth.VerifyToken {
    deterministic: true
  }
}`);
    const hover = getHover(document, positionAtText(document, "Auth.VerifyToken", 2));
    const value = hover && "value" in hover.contents ? hover.contents.value : "";

    expect(value).toContain("token");
    expect(value).toContain("valid: boolean");
  });

  it("explains deterministic", () => {
    const document = createDocument(`graph Hello {
  node recommend: ML.RecommendProducts {
    deterministic: false
  }
}`);
    const hover = getHover(document, positionAtText(document, "deterministic", 2));

    expect(hover && "value" in hover.contents ? hover.contents.value : "").toContain("predictable output");
  });

  it("explains the critical restriction", () => {
    const document = createDocument(`graph Hello {
  node verify: Auth.VerifyToken {
    risk: "critical"
  }
}`);
    const hover = getHover(document, positionAtText(document, "critical", 1));

    expect(hover && "value" in hover.contents ? hover.contents.value : "").toContain("forbidden");
  });
});
