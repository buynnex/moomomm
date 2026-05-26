import { describe, expect, it } from "vitest";
import { DiagnosticSeverity } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { getCompletionItems } from "../dist/completion.js";
import { getDocumentDiagnostics } from "../dist/diagnostics.js";
import { getHover } from "../dist/hover.js";
import { getDocumentSymbols } from "../dist/symbols.js";

describe("momom language server helpers", () => {
  it("suggests known ports for an edge target", () => {
    const source = `graph AuthRecommend {
  input user: User
  input token: Token
  input products: Product[]

  node verify: Auth.VerifyToken {
    deterministic: true
  }

  node recommend: ML.RecommendProducts {
    deterministic: false
  }

  edge token -> verify.
}`;

    const document = TextDocument.create("file:///auth_recommend.momom", "momom", 1, source);
    const lineIndex = source.split("\n").findIndex((line) => line.includes("edge token -> verify."));
    const position = {
      line: lineIndex,
      character: "  edge token -> verify.".length,
    };

    const labels = getCompletionItems(document, position).map((item) => item.label);
    expect(labels).toContain("token");
    expect(labels).toContain("user");
  });

  it("returns hover text for a known node type", () => {
    const source = `graph HelloUser {
  input name: string

  node greeting: Text.Template {
    template: "Hello, {name}"
  }

  edge name -> greeting
  output message: greeting.text
}`;

    const document = TextDocument.create("file:///hello.momom", "momom", 1, source);
    const offset = source.indexOf("Text.Template") + 2;
    const hover = getHover(document, document.positionAt(offset));

    expect(hover).toBeDefined();
    expect(hover && "value" in hover.contents ? hover.contents.value : "").toContain(
      "Text.Template creates a text output using a template string.",
    );
  });

  it("builds outline symbols for a simple graph", () => {
    const source = `graph HelloUser {
  input name: string

  node greeting: Text.Template {
    template: "Hello, {name}"
  }

  edge name -> greeting
  output message: greeting.text
}`;

    const document = TextDocument.create("file:///hello.momom", "momom", 1, source);
    const symbols = getDocumentSymbols(document);

    expect(symbols).toHaveLength(1);
    expect(symbols[0].name).toBe("Graph HelloUser");
    expect(symbols[0].children?.map((symbol) => symbol.name)).toEqual([
      "input name: string",
      "node greeting: Text.Template",
      "output message: greeting.text",
    ]);
  });

  it("maps parser failures to a controlled MOMOM001 diagnostic", () => {
    const source = "graph Broken {\n  edge token -> verify.\n";
    const document = TextDocument.create("file:///broken.momom", "momom", 1, source);
    const diagnostics = getDocumentDiagnostics(document);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("[MOMOM001]");
    expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
    expect(diagnostics[0].source).toBe("momom");
  });
});
