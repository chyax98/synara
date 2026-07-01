import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { normalizePersistedModelSelection } from "./modelSelectionCompatibility.ts";

describe("modelSelectionCompatibility", () => {
  it("leaves non-opencode provider selections untouched", () => {
    const legacy = { provider: "codex", model: "gpt-5.4" };
    assert.deepEqual(normalizePersistedModelSelection(legacy), legacy);
  });

  it("normalizes opencode option rows into an options object", () => {
    assert.deepEqual(
      normalizePersistedModelSelection({
        provider: "opencode",
        model: "openai/gpt-5",
        options: [{ id: "reasoningEffort", value: "high" }],
      }),
      {
        provider: "opencode",
        model: "openai/gpt-5",
        options: { reasoningEffort: "high" },
      },
    );
  });
});