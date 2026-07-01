// FILE: openCodeConfigParse.ts
// Purpose: Parse OpenCode JSON/JSONC config files for layer reads and writes.
// Layer: Server provider utilities

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Strip // and block comments outside JSON strings (JSONC support). */
export function stripJsoncComments(raw: string): string {
  let result = "";
  let index = 0;
  let inString = false;
  let stringDelimiter = "";

  while (index < raw.length) {
    const char = raw[index] ?? "";
    const next = raw[index + 1] ?? "";

    if (inString) {
      result += char;
      if (char === "\\") {
        result += raw[index + 1] ?? "";
        index += 2;
        continue;
      }
      if (char === stringDelimiter) {
        inString = false;
      }
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringDelimiter = char;
      result += char;
      index += 1;
      continue;
    }

    if (char === "/" && next === "/") {
      index += 2;
      while (index < raw.length && raw[index] !== "\n") {
        index += 1;
      }
      continue;
    }

    if (char === "/" && next === "*") {
      index += 2;
      while (index < raw.length && !(raw[index] === "*" && raw[index + 1] === "/")) {
        index += 1;
      }
      index += 2;
      continue;
    }

    result += char;
    index += 1;
  }

  return result;
}

export function parseOpenCodeConfigDocument(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(stripJsoncComments(trimmed));
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
