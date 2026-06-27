import { describe, expect, it } from "vitest";

import { parseAgentMentionInvocations } from "./agentMentions";

describe("parseAgentMentionInvocations", () => {
  it("returns no invocations when no aliases are configured", () => {
    expect(parseAgentMentionInvocations("Check @build(find the regression)", "opencode")).toEqual(
      [],
    );
  });
});