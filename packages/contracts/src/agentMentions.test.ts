import { describe, expect, it } from "vitest";

import {
  getAgentMentionAliases,
  getAgentMentionAutocompleteAliases,
  resolveAgentAlias,
} from "./agentMentions";

describe("agentMentions", () => {
  it("returns empty autocomplete aliases for OpenCode", () => {
    expect(getAgentMentionAutocompleteAliases("opencode")).toEqual([]);
  });

  it("returns empty alias lists until runtime discovery populates them", () => {
    expect(getAgentMentionAliases("opencode")).toEqual([]);
    expect(resolveAgentAlias("build", "opencode")).toBeNull();
  });
});
