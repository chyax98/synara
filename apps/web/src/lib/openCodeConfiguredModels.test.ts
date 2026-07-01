import { describe, expect, it } from "vitest";

import { listConfiguredModelSlugs } from "./openCodeConfiguredModels";

describe("listConfiguredModelSlugs", () => {
  it("lists models from config/custom provider sources only", () => {
    expect(
      listConfiguredModelSlugs([
        {
          id: "anthropic",
          name: "Anthropic",
          source: "api",
          models: { "claude-sonnet-4": { name: "Sonnet" } },
        },
        {
          id: "my-proxy",
          name: "My Proxy",
          source: "config",
          models: { "gpt-4o": { name: "GPT-4o" } },
        },
      ]),
    ).toEqual(["my-proxy/gpt-4o"]);
  });
});
