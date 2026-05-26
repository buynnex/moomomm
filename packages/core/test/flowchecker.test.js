import { describe, expect, it } from "vitest";
import { DiagnosticCodes } from "../dist/diagnostics.js";
import { analyzeGraphFlow } from "../dist/flowchecker.js";
import { parseGraph } from "../dist/parser.js";
import { readExample, readInvalidExample } from "./helpers.js";

describe("flowchecker", () => {
  it("AuthRecommend resolve token -> verify.token", () => {
    const analysis = analyzeGraphFlow(parseGraph(readExample("auth_recommend.momom")));
    expect(analysis.diagnostics).toEqual([]);
    expect(analysis.connections).toContainEqual(
      expect.objectContaining({
        from: "token",
        toNode: "verify",
        toPort: "token",
        inferred: true,
      }),
    );
  });

  it("AuthRecommend resolve products -> recommend.products", () => {
    const analysis = analyzeGraphFlow(parseGraph(readExample("auth_recommend.momom")));
    expect(analysis.connections).toContainEqual(
      expect.objectContaining({
        from: "products",
        toNode: "recommend",
        toPort: "products",
        inferred: true,
      }),
    );
  });

  it("HelloUser resolve name -> greeting.name", () => {
    const analysis = analyzeGraphFlow(parseGraph(readExample("hello.momom")));
    expect(analysis.diagnostics).toEqual([]);
    expect(analysis.connections).toContainEqual(
      expect.objectContaining({
        from: "name",
        toNode: "greeting",
        toPort: "name",
        inferred: true,
      }),
    );
  });

  it("FlowExplicitPorts aceita portas explicitas", () => {
    const analysis = analyzeGraphFlow(parseGraph(readExample("flow_explicit_ports.momom")));
    expect(analysis.diagnostics).toEqual([]);
    expect(analysis.connections).toContainEqual(
      expect.objectContaining({
        from: "token",
        to: "verify.token",
        toNode: "verify",
        toPort: "token",
        inferred: false,
      }),
    );
  });

  it("missing_required_node_input gera MOMOM020", () => {
    const diagnostics = analyzeGraphFlow(parseGraph(readInvalidExample("missing_required_node_input.momom"))).diagnostics;
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(DiagnosticCodes.MISSING_REQUIRED_NODE_INPUT);
  });

  it("incompatible_edge_type gera MOMOM021", () => {
    const diagnostics = analyzeGraphFlow(parseGraph(readInvalidExample("incompatible_edge_type.momom"))).diagnostics;
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(DiagnosticCodes.INCOMPATIBLE_EDGE_TYPE);
  });

  it("edge source inexistente gera MOMOM022", () => {
    const source = `graph BrokenEdgeSource {
  input token: Token

  node verify: Auth.VerifyToken {
    deterministic: true
  }

  edge missingToken -> verify.token

  output valid: verify.valid
}`;

    const diagnostics = analyzeGraphFlow(parseGraph(source)).diagnostics;
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(DiagnosticCodes.UNRESOLVED_EDGE_SOURCE);
  });

  it("invalid_target_port gera MOMOM023", () => {
    const diagnostics = analyzeGraphFlow(parseGraph(readInvalidExample("invalid_target_port.momom"))).diagnostics;
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(DiagnosticCodes.INVALID_NODE_PORT);
  });

  it("duplicate_port_connection gera MOMOM024", () => {
    const diagnostics = analyzeGraphFlow(parseGraph(readInvalidExample("duplicate_port_connection.momom"))).diagnostics;
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(DiagnosticCodes.DUPLICATE_NODE_PORT_CONNECTION);
  });

  it("missing_required_property gera MOMOM025", () => {
    const diagnostics = analyzeGraphFlow(parseGraph(readInvalidExample("missing_required_property.momom"))).diagnostics;
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(DiagnosticCodes.MISSING_REQUIRED_NODE_PROPERTY);
  });

  it("invalid_property_type gera MOMOM026", () => {
    const diagnostics = analyzeGraphFlow(parseGraph(readInvalidExample("invalid_property_type.momom"))).diagnostics;
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(DiagnosticCodes.INVALID_NODE_PROPERTY_TYPE);
  });

  it("cannot_infer_port gera MOMOM027", () => {
    const diagnostics = analyzeGraphFlow(parseGraph(readInvalidExample("cannot_infer_port.momom"))).diagnostics;
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(DiagnosticCodes.CANNOT_INFER_EDGE_PORT);
  });

  it("executionPlan inclui todos os nodes conhecidos", () => {
    const analysis = analyzeGraphFlow(parseGraph(readExample("auth_recommend.momom")));
    expect(analysis.executionPlan).toHaveLength(3);
    expect(analysis.executionPlan.map((item) => item.nodeId)).toEqual(
      expect.arrayContaining(["verify", "recommend", "block"]),
    );
    expect(analysis.executionPlan.map((item) => item.order)).toEqual([0, 1, 2]);
  });

  it("ciclo continua gerando MOMOM010", () => {
    const diagnostics = analyzeGraphFlow(parseGraph(readInvalidExample("cycle_simple.momom"))).diagnostics;
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(DiagnosticCodes.GRAPH_CYCLE);
  });
});
