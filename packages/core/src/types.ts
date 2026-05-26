export interface MomomType {
  name: string;
  isArray: boolean;
  raw: string;
}

const NATIVE_TYPES = new Set(["string", "number", "boolean", "unknown", "any", "void"]);

export function parseMomomType(raw: string): MomomType {
  const normalized = raw.trim() || "unknown";
  const isArray = normalized.endsWith("[]");
  const name = isArray ? normalized.slice(0, -2).trim() || "unknown" : normalized;

  return {
    name,
    isArray,
    raw: normalized,
  };
}

export function momomTypeToTypeScript(type: MomomType): string {
  return type.isArray ? `${type.name}[]` : type.name;
}

export function isNativeType(typeName: string): boolean {
  return NATIVE_TYPES.has(typeName.trim());
}

export function areTypesCompatible(from: MomomType, to: MomomType): boolean {
  if (from.name === "any" || to.name === "any") {
    return true;
  }

  if (to.name === "unknown") {
    return true;
  }

  if (from.name === "unknown") {
    return to.name === "unknown";
  }

  if (from.isArray !== to.isArray) {
    return false;
  }

  return from.name === to.name;
}
