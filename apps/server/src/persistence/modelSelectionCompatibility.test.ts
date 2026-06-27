import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeLegacyModelSelection,
  normalizePersistedModelSelection,
} from "./modelSelectionCompatibility.ts";

describe("modelSelectionCompatibility", () => {
  it("maps legacy provider literals to opencode", () => {
    assert.deepEqual(normalizePersistedModelSelection({ provider: "pi", model: "openai/gpt-5.5" }), {
      provider: "opencode",
      model: "openai/gpt-5.5",
    });
    assert.deepEqual(
      normalizePersistedModelSelection({
        provider: "claudeAgent",
        model: "claude-sonnet-4-6",
      }),
      {
        provider: "opencode",
        model: "claude-sonnet-4-6",
      },
    );
  });

  it("normalizes legacy provider-scoped options into opencode options", () => {
    assert.deepEqual(
      normalizeLegacyModelSelection({
        provider: "codex",
        model: "gpt-5.4",
        options: {
          codex: { reasoningEffort: "high" },
        },
      }),
      {
        provider: "opencode",
        model: "gpt-5.4",
        options: {
          codex: { reasoningEffort: "high" },
        },
      },
    );
  });
});