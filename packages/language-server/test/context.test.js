import { describe, expect, it } from "vitest";
import { getMomomCursorContext } from "../dist/context.js";

describe("context", () => {
  it("identifies input type context", () => {
    const source = "graph Hello {\n  input name: \n}";
    const context = getMomomCursorContext(source, {
      line: 1,
      character: "  input name: ".length,
    });

    expect(context.context).toBe("input-type");
  });

  it("identifies node type context", () => {
    const source = "graph Hello {\n  node greeting: \n}";
    const context = getMomomCursorContext(source, {
      line: 1,
      character: "  node greeting: ".length,
    });

    expect(context.context).toBe("node-type");
  });

  it("identifies edge target port context", () => {
    const source = "graph Hello {\n  edge name -> greeting.\n}";
    const context = getMomomCursorContext(source, {
      line: 1,
      character: "  edge name -> greeting.".length,
    });

    expect(context.context).toBe("edge-target-port");
    expect(context.nodeId).toBe("greeting");
  });

  it("identifies output reference property context", () => {
    const source = "graph Hello {\n  output result: recommend.\n}";
    const context = getMomomCursorContext(source, {
      line: 1,
      character: "  output result: recommend.".length,
    });

    expect(context.context).toBe("output-reference-property");
    expect(context.referenceRoot).toBe("recommend");
  });

  it("does not crash with an incomplete file", () => {
    const source = "graph Hello {\n  node greeting: Text.Template {\n    template:\n";

    expect(() =>
      getMomomCursorContext(source, {
        line: 2,
        character: "    template:".length,
      }),
    ).not.toThrow();
  });
});
