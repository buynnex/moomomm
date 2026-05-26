import type { EdgeAst, GraphAst, NodeAst, SourceLocation } from "./ast.js";
import { DiagnosticCodes, createDiagnostic, type Diagnostic } from "./diagnostics.js";
import {
  extractTemplateVariables,
  resolveNodeContract,
  type NodePropertyContract,
  type ResolvedNodeContract,
} from "./node-registry.js";
import { parseReference, resolveReferenceType } from "./references.js";
import { areTypesCompatible, momomTypeToTypeScript, parseMomomType } from "./types.js";

export interface ResolvedConnection {
  from: string;
  fromType: string;
  to: string;
  toNode: string;
  toPort: string | null;
  acceptedTypes: string[];
  inferred: boolean;
}

export interface ExecutionPlanItem {
  nodeId: string;
  order: number;
  dependsOn: string[];
}

export interface GraphFlowAnalysis {
  diagnostics: Diagnostic[];
  connections: ResolvedConnection[];
  executionPlan: ExecutionPlanItem[];
}

export function analyzeGraphFlow(graph: GraphAst): GraphFlowAnalysis {
  const diagnostics: Diagnostic[] = [];
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const resolvedContracts = new Map(graph.nodes.map((node) => [node.id, resolveNodeContract(node)]));
  const connectedPorts = new Map<string, Map<string, ResolvedConnection[]>>();
  const connections: ResolvedConnection[] = [];

  for (const node of graph.nodes) {
    const contract = resolvedContracts.get(node.id);
    if (!contract) {
      continue;
    }

    diagnostics.push(...validateNodeProperties(node, contract.properties));
  }

  for (const edge of graph.edges) {
    const sourceResolution = resolveReferenceType({ reference: edge.from, graph });
    if (!sourceResolution.ok) {
      diagnostics.push(mapEdgeSourceDiagnostic(edge, sourceResolution.reason, edge.loc));
      continue;
    }

    const targetNodeId = edge.targetNode ?? parseReference(edge.to).root;
    const targetNode = nodeById.get(targetNodeId);
    if (!targetNode) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.MISSING_REFERENCE,
          `A referencia "${edge.to}" da edge nao existe.`,
          "error",
          edge.loc,
        ),
      );
      continue;
    }

    const targetContract = resolvedContracts.get(targetNode.id);
    const nodeConnections = connectedPorts.get(targetNode.id) ?? new Map<string, ResolvedConnection[]>();
    const portResolution = resolveTargetPort({
      edge,
      sourceReference: sourceResolution.reference.raw,
      sourceRoot: sourceResolution.reference.root,
      targetNode,
      targetContract,
      connectedPorts: nodeConnections,
    });

    if (!portResolution.ok) {
      diagnostics.push(createDiagnostic(portResolution.code, portResolution.message, "error", edge.loc));
      continue;
    }

    const acceptedTypes = resolveAcceptedTypes(targetContract, portResolution.port);
    if (acceptedTypes === null) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.INVALID_NODE_PORT,
          `A porta "${portResolution.port}" nao existe no node "${targetNode.id}".`,
          "error",
          edge.loc,
        ),
      );
      continue;
    }

    if (portResolution.port) {
      const existingConnections = nodeConnections.get(portResolution.port) ?? [];
      if (existingConnections.length > 0) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.DUPLICATE_NODE_PORT_CONNECTION,
            `A porta "${portResolution.port}" do node "${targetNode.id}" foi conectada mais de uma vez.`,
            "error",
            edge.loc,
          ),
        );
      }
    }

    if (acceptedTypes.length > 0) {
      const isCompatible = acceptedTypes.some((acceptedType) =>
        isSourceTypeAcceptedByPort(sourceResolution.type.raw, acceptedType),
      );

      if (!isCompatible) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.INCOMPATIBLE_EDGE_TYPE,
            `O tipo da edge "${edge.from} -> ${edge.to}" e incompativel com a porta do node.`,
            "error",
            edge.loc,
          ),
        );
      }
    }

    const connection: ResolvedConnection = {
      from: edge.from,
      fromType: momomTypeToTypeScript(sourceResolution.type),
      to: edge.to,
      toNode: targetNode.id,
      toPort: portResolution.port,
      acceptedTypes,
      inferred: portResolution.inferred,
    };

    connections.push(connection);

    if (portResolution.port) {
      const existingConnections = nodeConnections.get(portResolution.port) ?? [];
      nodeConnections.set(portResolution.port, [...existingConnections, connection]);
      connectedPorts.set(targetNode.id, nodeConnections);
    }
  }

  for (const node of graph.nodes) {
    const contract = resolvedContracts.get(node.id);
    if (!contract) {
      continue;
    }

    const nodeConnections = connectedPorts.get(node.id) ?? new Map<string, ResolvedConnection[]>();
    for (const inputContract of contract.inputs) {
      if (!inputContract.required) {
        continue;
      }

      if ((nodeConnections.get(inputContract.name) ?? []).length === 0) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.MISSING_REQUIRED_NODE_INPUT,
            `O node "${node.id}" esta sem o input obrigatorio "${inputContract.name}".`,
            "error",
            node.loc,
          ),
        );
      }
    }
  }

  const executionPlanResult = buildExecutionPlan(graph);
  diagnostics.push(...executionPlanResult.diagnostics);
  diagnostics.push(...detectPossiblyUnreachableNodes(graph, executionPlanResult.executionPlan));
  diagnostics.push(...detectUnusedInputs(graph));

  return {
    diagnostics: dedupeDiagnostics(diagnostics),
    connections,
    executionPlan: executionPlanResult.executionPlan,
  };
}

function validateNodeProperties(node: NodeAst, propertyContracts: NodePropertyContract[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const propertyContract of propertyContracts) {
    const value = node.properties[propertyContract.name];
    if (value === undefined) {
      if (propertyContract.required) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.MISSING_REQUIRED_NODE_PROPERTY,
            `O node "${node.id}" esta sem a propriedade obrigatoria "${propertyContract.name}".`,
            "error",
            node.loc,
          ),
        );
      }
      continue;
    }

    if (typeof value !== propertyContract.type) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.INVALID_NODE_PROPERTY_TYPE,
          `O node "${node.id}" possui tipo invalido para a propriedade "${propertyContract.name}".`,
          "error",
          node.loc,
        ),
      );
    }
  }

  return diagnostics;
}

function resolveTargetPort(params: {
  edge: EdgeAst;
  sourceReference: string;
  sourceRoot: string;
  targetNode: NodeAst;
  targetContract: ResolvedNodeContract | undefined;
  connectedPorts: Map<string, ResolvedConnection[]>;
}):
  | { ok: true; port: string | null; inferred: boolean }
  | { ok: false; code: typeof DiagnosticCodes.CANNOT_INFER_EDGE_PORT; message: string } {
  if (params.edge.targetPort) {
    return {
      ok: true,
      port: params.edge.targetPort,
      inferred: false,
    };
  }

  const contract = params.targetContract;
  if (!contract) {
    return {
      ok: false,
      code: DiagnosticCodes.CANNOT_INFER_EDGE_PORT,
      message: `Nao foi possivel inferir a porta da edge "${params.edge.from} -> ${params.edge.to}".`,
    };
  }

  const exactRootMatch = contract.inputs.find((inputContract) => inputContract.name === params.sourceRoot);
  if (exactRootMatch) {
    return {
      ok: true,
      port: exactRootMatch.name,
      inferred: true,
    };
  }

  const exactReferenceMatch = contract.inputs.find((inputContract) => inputContract.name === params.sourceReference);
  if (exactReferenceMatch) {
    return {
      ok: true,
      port: exactReferenceMatch.name,
      inferred: true,
    };
  }

  const unresolvedRequiredInputs = contract.inputs.filter(
    (inputContract) => inputContract.required && (params.connectedPorts.get(inputContract.name) ?? []).length === 0,
  );
  if (unresolvedRequiredInputs.length === 1) {
    return {
      ok: true,
      port: unresolvedRequiredInputs[0].name,
      inferred: true,
    };
  }

  return {
    ok: false,
    code: DiagnosticCodes.CANNOT_INFER_EDGE_PORT,
    message: `Nao foi possivel inferir a porta da edge "${params.edge.from} -> ${params.edge.to}".`,
  };
}

function resolveAcceptedTypes(
  contract: ResolvedNodeContract | undefined,
  port: string | null,
): string[] | null {
  if (!port) {
    return [];
  }

  if (!contract) {
    return [];
  }

  const inputContract = contract.inputs.find((candidate) => candidate.name === port);
  if (!inputContract) {
    return null;
  }

  return [...inputContract.types];
}

function mapEdgeSourceDiagnostic(
  edge: EdgeAst,
  reason: "missing-reference" | "missing-property" | "unresolved-type",
  loc: SourceLocation | undefined,
): Diagnostic {
  if (reason === "missing-property") {
    return createDiagnostic(
      DiagnosticCodes.INVALID_REFERENCE_PROPERTY,
      `A propriedade inexistente na referencia "${edge.from}".`,
      "error",
      loc,
    );
  }

  if (reason === "unresolved-type") {
    return createDiagnostic(
      DiagnosticCodes.UNRESOLVED_TYPE,
      `Nao foi possivel resolver o tipo da referencia "${edge.from}".`,
      "error",
      loc,
    );
  }

  return createDiagnostic(
    DiagnosticCodes.UNRESOLVED_EDGE_SOURCE,
    `A source da edge "${edge.from}" nao foi resolvida.`,
    "error",
    loc,
  );
}

function buildExecutionPlan(
  graph: GraphAst,
): { diagnostics: Diagnostic[]; executionPlan: ExecutionPlanItem[] } {
  const diagnostics: Diagnostic[] = [];
  const nodeOrder = new Map(graph.nodes.map((node, index) => [node.id, index]));
  const dependencies = new Map<string, Set<string>>();
  const reverseDependencies = new Map<string, Set<string>>();

  for (const node of graph.nodes) {
    dependencies.set(node.id, new Set<string>());
    reverseDependencies.set(node.id, new Set<string>());
  }

  for (const edge of graph.edges) {
    const sourceRoot = parseReference(edge.from).root;
    const targetNode = edge.targetNode ?? parseReference(edge.to).root;
    if (!dependencies.has(sourceRoot) || !dependencies.has(targetNode)) {
      continue;
    }

    if (sourceRoot === targetNode) {
      continue;
    }

    dependencies.get(targetNode)?.add(sourceRoot);
    reverseDependencies.get(sourceRoot)?.add(targetNode);
  }

  for (const branch of graph.branches) {
    const sourceRoot = parseReference(branch.source).root;
    if (!dependencies.has(sourceRoot)) {
      continue;
    }

    for (const branchCase of branch.cases) {
      if (!dependencies.has(branchCase.target) || branchCase.target === sourceRoot) {
        continue;
      }

      dependencies.get(branchCase.target)?.add(sourceRoot);
      reverseDependencies.get(sourceRoot)?.add(branchCase.target);
    }
  }

  const indegree = new Map<string, number>();
  for (const [nodeId, nodeDependencies] of dependencies) {
    indegree.set(nodeId, nodeDependencies.size);
  }

  const queue = graph.nodes
    .filter((node) => (indegree.get(node.id) ?? 0) === 0)
    .sort((left, right) => (nodeOrder.get(left.id) ?? 0) - (nodeOrder.get(right.id) ?? 0))
    .map((node) => node.id);

  const orderedNodeIds: string[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    orderedNodeIds.push(nodeId);

    const dependents = [...(reverseDependencies.get(nodeId) ?? new Set<string>())].sort(
      (left, right) => (nodeOrder.get(left) ?? 0) - (nodeOrder.get(right) ?? 0),
    );

    for (const dependentNodeId of dependents) {
      indegree.set(dependentNodeId, (indegree.get(dependentNodeId) ?? 0) - 1);
      if ((indegree.get(dependentNodeId) ?? 0) === 0) {
        queue.push(dependentNodeId);
      }
    }
  }

  if (orderedNodeIds.length < graph.nodes.length) {
    diagnostics.push(
      createDiagnostic(
        DiagnosticCodes.GRAPH_CYCLE,
        "Ciclo detectado no grafo.",
        "error",
        graph.loc,
      ),
    );

    for (const node of graph.nodes) {
      if (!orderedNodeIds.includes(node.id)) {
        orderedNodeIds.push(node.id);
      }
    }
  }

  return {
    diagnostics,
    executionPlan: orderedNodeIds.map((nodeId, order) => ({
      nodeId,
      order,
      dependsOn: [...(dependencies.get(nodeId) ?? new Set<string>())].sort(
        (left, right) => (nodeOrder.get(left) ?? 0) - (nodeOrder.get(right) ?? 0),
      ),
    })),
  };
}

function detectPossiblyUnreachableNodes(graph: GraphAst, executionPlan: ExecutionPlanItem[]): Diagnostic[] {
  if (graph.outputs.length === 0 && graph.branches.length === 0) {
    return [];
  }

  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const dependencies = new Map(executionPlan.map((item) => [item.nodeId, new Set(item.dependsOn)]));
  const usefulNodes = new Set<string>();
  const queue: string[] = [];

  for (const output of graph.outputs) {
    const root = parseReference(output.reference).root;
    if (nodeIds.has(root) && !usefulNodes.has(root)) {
      usefulNodes.add(root);
      queue.push(root);
    }
  }

  for (const branch of graph.branches) {
    const branchRoot = parseReference(branch.source).root;
    if (nodeIds.has(branchRoot) && !usefulNodes.has(branchRoot)) {
      usefulNodes.add(branchRoot);
      queue.push(branchRoot);
    }

    for (const branchCase of branch.cases) {
      if (nodeIds.has(branchCase.target) && !usefulNodes.has(branchCase.target)) {
        usefulNodes.add(branchCase.target);
        queue.push(branchCase.target);
      }
    }
  }

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    for (const dependency of dependencies.get(nodeId) ?? new Set<string>()) {
      if (!usefulNodes.has(dependency)) {
        usefulNodes.add(dependency);
        queue.push(dependency);
      }
    }
  }

  return graph.nodes
    .filter((node) => !usefulNodes.has(node.id))
    .map((node) =>
      createDiagnostic(
        DiagnosticCodes.POSSIBLY_UNREACHABLE_NODE,
        `O node "${node.id}" pode estar inalcancavel.`,
        "warning",
        node.loc,
      ),
    );
}

function detectUnusedInputs(graph: GraphAst): Diagnostic[] {
  const usedInputs = new Set<string>();
  const inputNames = new Set(graph.inputs.map((input) => input.name));

  for (const edge of graph.edges) {
    const root = parseReference(edge.from).root;
    if (inputNames.has(root)) {
      usedInputs.add(root);
    }
  }

  for (const output of graph.outputs) {
    const root = parseReference(output.reference).root;
    if (inputNames.has(root)) {
      usedInputs.add(root);
    }
  }

  for (const branch of graph.branches) {
    const root = parseReference(branch.source).root;
    if (inputNames.has(root)) {
      usedInputs.add(root);
    }
  }

  for (const node of graph.nodes) {
    if (node.type !== "Text.Template") {
      continue;
    }

    const template = typeof node.properties.template === "string" ? node.properties.template : "";
    for (const variable of extractTemplateVariables(template)) {
      const root = parseReference(variable).root;
      if (inputNames.has(root)) {
        usedInputs.add(root);
      }
    }
  }

  return graph.inputs
    .filter((input) => !usedInputs.has(input.name))
    .map((input) =>
      createDiagnostic(
        DiagnosticCodes.UNUSED_INPUT,
        `O input "${input.name}" foi declarado mas nao usado.`,
        "warning",
        input.loc,
      ),
    );
}

function dedupeDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();

  return diagnostics.filter((diagnostic) => {
    const key = [
      diagnostic.code,
      diagnostic.severity,
      diagnostic.message,
      diagnostic.loc?.file ?? "",
      diagnostic.loc?.line ?? "",
      diagnostic.loc?.column ?? "",
    ].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function isSourceTypeAcceptedByPort(sourceType: string, acceptedType: string): boolean {
  if (acceptedType === "unknown") {
    return sourceType === "unknown" || sourceType === "any";
  }

  return areTypesCompatible(parseMomomType(sourceType), parseMomomType(acceptedType));
}
