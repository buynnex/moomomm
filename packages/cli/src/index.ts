#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  analyzeGraphFlow,
  buildIR,
  CompilerDiagnosticError,
  compileGraphToTypeScript,
  formatDiagnostic,
  graphToMermaid,
  parseGraph,
  validateGraph,
} from "@momom/core";

function main(argv: string[]): number {
  const [command, filePath, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    printUsage();
    return 0;
  }

  if (!filePath) {
    console.error("Arquivo .momom ausente.");
    printUsage();
    return 1;
  }

  const absolutePath = resolve(process.cwd(), filePath);
  const source = readFileSync(absolutePath, "utf8");
  const graph = parseGraph(source, { file: filePath });

  if (command === "parse") {
    const format = readOption(rest, "--format") ?? "ast";
    if (format === "ast") {
      console.log(JSON.stringify(graph, null, 2));
      return 0;
    }

    if (format === "ir") {
      console.log(JSON.stringify(buildIR(graph), null, 2));
      return 0;
    }

    console.error('Formato invalido. Use "--format ast" ou "--format ir".');
    return 1;
  }

  if (command === "graph") {
    const format = readOption(rest, "--format") ?? "mermaid";
    const validation = validateOrPrint(graph);
    if (!validation.valid) {
      return 1;
    }

    if (format !== "mermaid") {
      console.error('Formato invalido. Use "--format mermaid".');
      return 1;
    }

    console.log(graphToMermaid(graph));
    return 0;
  }

  if (command === "inspect") {
    const format = readOption(rest, "--format") ?? "flow";
    if (format !== "flow") {
      console.error('Formato invalido. Use "--format flow".');
      return 1;
    }

    console.log(JSON.stringify(analyzeGraphFlow(graph), null, 2));
    return 0;
  }

  const validation = validateOrPrint(graph);
  if (!validation.valid) {
    return 1;
  }

  if (command === "validate") {
    if (validation.diagnostics.some((diagnostic) => diagnostic.severity === "warning")) {
      console.log("Validation succeeded with warnings.");
      return 0;
    }

    console.log("Validation succeeded.");
    return 0;
  }

  if (command === "compile") {
    const target = readOption(rest, "--target");
    if (target !== "typescript") {
      console.error('Target invalido. Use "--target typescript".');
      return 1;
    }

    const outPath = readOption(rest, "--out");
    const output = compileGraphToTypeScript(graph);

    if (!outPath) {
      console.log(output);
      return 0;
    }

    const absoluteOutPath = resolve(process.cwd(), outPath);
    mkdirSync(dirname(absoluteOutPath), { recursive: true });
    writeFileSync(absoluteOutPath, output, "utf8");
    console.log(`Compiled successfully: ${outPath}`);
    return 0;
  }

  console.error(`Comando desconhecido: ${command}`);
  printUsage();
  return 1;
}

function validateOrPrint(graph: Parameters<typeof validateGraph>[0]): ReturnType<typeof validateGraph> {
  const validation = validateGraph(graph);
  if (validation.diagnostics.length > 0) {
    for (const diagnostic of validation.diagnostics) {
      const printer = diagnostic.severity === "warning" ? console.warn : console.error;
      printer(formatDiagnostic(diagnostic));
    }
  }

  return validation;
}

function readOption(args: string[], optionName: string): string | undefined {
  const optionIndex = args.indexOf(optionName);
  if (optionIndex === -1) {
    return undefined;
  }

  return args[optionIndex + 1];
}

function printUsage(): void {
  console.log(`momom parse <arquivo.momom>
momom parse <arquivo.momom> --format ast
momom parse <arquivo.momom> --format ir
momom validate <arquivo.momom>
momom compile <arquivo.momom> --target typescript [--out caminho/arquivo.ts]
momom graph <arquivo.momom> --format mermaid
momom inspect <arquivo.momom> --format flow`);
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  if (error instanceof CompilerDiagnosticError) {
    for (const diagnostic of error.diagnostics) {
      console.error(formatDiagnostic(diagnostic));
    }
  } else
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }

  process.exitCode = 1;
}
