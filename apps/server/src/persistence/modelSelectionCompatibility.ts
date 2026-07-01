// FILE: modelSelectionCompatibility.ts
// Purpose: Normalizes persisted OpenCode model-selection option shape only.
// Layer: Persistence helper
// Exports: normalizePersistedModelSelection

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTrimmedString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeModelOptions(input: unknown): unknown {
  if (!Array.isArray(input)) {
    return input;
  }

  const entries: Array<readonly [string, unknown]> = [];
  for (const option of input) {
    if (!isRecord(option)) {
      return input;
    }
    const id = readTrimmedString(option, "id");
    if (id === undefined) {
      return input;
    }
    entries.push([id, option.value]);
  }
  return Object.fromEntries(entries);
}

export function normalizePersistedModelSelection(input: unknown): unknown {
  if (!isRecord(input)) {
    return input;
  }

  const model = readTrimmedString(input, "model");
  if (model === undefined || input.provider !== "opencode") {
    return input;
  }

  const options = normalizeModelOptions(input.options);
  return {
    provider: "opencode",
    model,
    ...(options === undefined ? {} : { options }),
  };
}