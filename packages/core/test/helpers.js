import { readFileSync } from "node:fs";

export function readExample(fileName) {
  return readFileSync(new URL(`../../../examples/${fileName}`, import.meta.url), "utf8");
}

export function readInvalidExample(fileName) {
  return readFileSync(new URL(`../../../examples/invalid/${fileName}`, import.meta.url), "utf8");
}
