import { describe, expect, it } from "vitest";
import { DiagnosticSeverity } from "vscode-languageserver";
import { getDocumentDiagnostics } from "../dist/diagnostics.js";
import { createDocument } from "./helpers.js";

describe("diagnostics", () => {
  it("maps parser failures to MOMOM001", () => {
    const document = createDocument("graph Broken {\n  edge token -> verify.\n");
    const diagnostics = getDocumentDiagnostics(document);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("[MOMOM001]");
    expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
    expect(diagnostics[0].source).toBe("momom");
  });
});
