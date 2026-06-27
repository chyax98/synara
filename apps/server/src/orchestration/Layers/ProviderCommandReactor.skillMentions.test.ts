// FILE: ProviderCommandReactor.skillMentions.test.ts
// Purpose: Covers provider-specific prompt text normalization for selected skills.
// Layer: Server orchestration tests
// Exports: Vitest cases for ProviderCommandReactor helpers.

import { describe, expect, it } from "vitest";

import { normalizeSkillMentionTextForProvider } from "./ProviderCommandReactor.ts";

describe("normalizeSkillMentionTextForProvider", () => {
  it("leaves slash-selected skills untouched for opencode dispatch", () => {
    expect(
      normalizeSkillMentionTextForProvider({
        provider: "opencode",
        messageText: "Use /check-code and /recap please",
        skills: [
          { name: "check-code", path: "/skills/check-code/SKILL.md" },
          { name: "recap", path: "/skills/recap/SKILL.md" },
        ],
      }),
    ).toBe("Use /check-code and /recap please");
  });

  it("leaves slash skills untouched when no skill metadata is provided", () => {
    expect(
      normalizeSkillMentionTextForProvider({
        provider: "opencode",
        messageText: "Use /check-code please",
        skills: [{ name: "check-code", path: "/skills/check-code/SKILL.md" }],
      }),
    ).toBe("Use /check-code please");
  });
});