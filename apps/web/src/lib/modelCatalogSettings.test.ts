import { describe, expect, it } from "vitest";

import {
  resolveCatalogModelSelection,
  resolveOpenCodeDefaultChatModel,
} from "./modelCatalogSettings";

describe("resolveOpenCodeDefaultChatModel", () => {
  it("returns configured default when present in catalog", () => {
    expect(
      resolveOpenCodeDefaultChatModel("anthropic/claude-sonnet-4", [
        { slug: "anthropic/claude-sonnet-4" },
      ]),
    ).toBe("anthropic/claude-sonnet-4");
  });

  it("does not fall back to static gpt-5 when catalog is empty", () => {
    expect(resolveOpenCodeDefaultChatModel("openai/gpt-5", [])).toBe("");
  });
});

describe("resolveCatalogModelSelection", () => {
  it("keeps candidate when it exists in catalog", () => {
    expect(
      resolveCatalogModelSelection({
        candidate: "xai/grok-3",
        catalogOptions: [{ slug: "xai/grok-3" }, { slug: "anthropic/claude-sonnet-4" }],
        defaultChatModel: "anthropic/claude-sonnet-4",
      }),
    ).toBe("xai/grok-3");
  });

  it("uses defaultChatModel from catalog when candidate is missing", () => {
    expect(
      resolveCatalogModelSelection({
        candidate: "openai/gpt-5",
        catalogOptions: [{ slug: "anthropic/claude-sonnet-4" }],
        defaultChatModel: "anthropic/claude-sonnet-4",
      }),
    ).toBe("anthropic/claude-sonnet-4");
  });

  it("returns empty when catalog is unloaded", () => {
    expect(
      resolveCatalogModelSelection({
        candidate: "openai/gpt-5",
        catalogOptions: [],
        defaultChatModel: "openai/gpt-5",
      }),
    ).toBe("");
  });
});
