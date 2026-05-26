#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildIR,
  compileToTypeScript,
  formatDiagnostic,
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
    console.log(JSON.stringify(graph, null, 2));
    return 0;
  }

  const validation = validateGraph(graph);
  if (!validation.valid) {
    for (const diagnostic of validation.diagnostics) {
      console.error(formatDiagnostic(diagnostic));
    }
    return 1;
  }

  if (command === "validate") {
    console.log("Validation succeeded.");
    return 0;
  }

  if (command === "compile") {
    const target = readOption(rest, "--target");
    if (target !== "typescript") {
      console.error('Target invalido. Use "--target typescript".');
      return 1;
    }

    const ir = buildIR(graph);
    console.log(compileToTypeScript(ir));
    return 0;
  }

  console.error(`Comando desconhecido: ${command}`);
  printUsage();
  return 1;
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
momom validate <arquivo.momom>
momom compile <arquivo.momom> --target typescript`);
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }

  process.exitCode = 1;
}
