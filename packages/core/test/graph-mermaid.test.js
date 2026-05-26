import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { graphToMermaid } from "../dist/graph-mermaid.js";
import { parseGraph } from "../dist/parser.js";

function readExample(fileName) {
  return readFileSync(new URL(`../../../examples/${fileName}`, import.meta.url), "utf8");
}

describe("graph mermaid", () => {
  it("gera flowchart TD com inputs, nodes, edges, outputs e branches", () => {
    const mermaid = graphToMermaid(parseGraph(readExample("auth_recommend.momom")));

    expect(mermaid).toContain("flowchart TD");
    expect(mermaid).toContain('input_user["input user: User"]');
    expect(mermaid).toContain('verify["verify: Auth.VerifyToken"]');
    expect(mermaid).toContain("input_user --> verify");
    expect(mermaid).toContain('output_result["output result"]');
    expect(mermaid).toContain('verify -->|"true"| recommend');
    expect(mermaid).toContain('verify -->|"false"| block');
  });

  it("gera edges com portas explicitas usando os nodes corretos", () => {
    const mermaid = graphToMermaid(parseGraph(readExample("flow_explicit_ports.momom")));

    expect(mermaid).toContain("flowchart TD");
    expect(mermaid).toContain("input_token --> verify");
    expect(mermaid).toContain("input_products --> recommend");
    expect(mermaid).toContain("input_customerName --> message");
    expect(mermaid).toContain('verify -->|"true"| recommend');
    expect(mermaid).toContain('verify -->|"false"| message');
  });
});
