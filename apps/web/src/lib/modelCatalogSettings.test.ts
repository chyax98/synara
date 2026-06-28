import { describe, expect, it } from "vitest";

import {
  buildModelCatalogSidebar,
  filterVisibleModelOptions,
  groupModelOptionsByUpstreamProvider,
  isModelSlugHidden,
  parseOpenCodeModelSlug,
  resolveOpenCodeDefaultChatModel,
  setModelsVisibilityBySlugs,
  toggleHiddenModelRef,
} from "./modelCatalogSettings";

describe("parseOpenCodeModelSlug", () => {
  it("parses provider/model pairs", () => {
    expect(parseOpenCodeModelSlug("anthropic/claude-sonnet-4")).toEqual({
      providerID: "anthropic",
      modelID: "claude-sonnet-4",
    });
  });

  it("returns null for invalid slugs", () => {
    expect(parseOpenCodeModelSlug("gpt-5")).toBeNull();
    expect(parseOpenCodeModelSlug("/missing-provider")).toBeNull();
  });
});

describe("hidden model visibility", () => {
  const hidden = [{ providerID: "openai", modelID: "gpt-5" }];

  it("detects hidden slugs", () => {
    expect(isModelSlugHidden("openai/gpt-5", hidden)).toBe(true);
    expect(isModelSlugHidden("anthropic/claude-sonnet-4", hidden)).toBe(false);
  });

  it("filters model options while preserving the active selection", () => {
    const options = [
      { slug: "openai/gpt-5", name: "GPT-5" },
      { slug: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4" },
    ];
    expect(filterVisibleModelOptions(options, hidden)).toEqual([
      { slug: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4" },
    ]);
    expect(
      filterVisibleModelOptions(options, hidden, { alwaysIncludeSlug: "openai/gpt-5" }),
    ).toEqual(options);
  });

  it("toggles and bulk-updates provider visibility", () => {
    const ref = { providerID: "openai", modelID: "gpt-5" };
    expect(toggleHiddenModelRef([], ref, false)).toEqual([ref]);
    expect(toggleHiddenModelRef([ref], ref, true)).toEqual([]);
    expect(setModelsVisibilityBySlugs([], ["openai/gpt-5", "openai/gpt-4"], false)).toEqual([
      { providerID: "openai", modelID: "gpt-5" },
      { providerID: "openai", modelID: "gpt-4" },
    ]);
  });
});

describe("buildModelCatalogSidebar", () => {
  it("merges availability with model groups and sorts connected providers first", () => {
    const modelGroups = groupModelOptionsByUpstreamProvider([
      {
        slug: "openai/gpt-5",
        name: "GPT-5",
        upstreamProviderId: "openai",
        upstreamProviderName: "OpenAI",
      },
    ]);
    const sidebar = buildModelCatalogSidebar({
      availability: [
        { id: "anthropic", name: "Anthropic" },
        { id: "openai", name: "OpenAI" },
      ],
      connectedIds: new Set(["openai"]),
      modelGroups,
    });

    expect(sidebar.sidebarGroups.map((group) => group.id)).toEqual(["openai", "anthropic"]);
    expect(sidebar.sidebarGroups[0]?.models).toHaveLength(1);
    expect(sidebar.sidebarGroups[1]?.models).toHaveLength(0);
    expect(sidebar.unconnectedProviders.map((group) => group.id)).toEqual(["anthropic"]);
  });
});

describe("resolveOpenCodeDefaultChatModel", () => {
  const catalog = [{ slug: "anthropic/claude-sonnet-4" }, { slug: "openai/gpt-5" }];

  it("returns configured slug when present in catalog", () => {
    expect(resolveOpenCodeDefaultChatModel("anthropic/claude-sonnet-4", catalog)).toBe(
      "anthropic/claude-sonnet-4",
    );
  });

  it("falls back to first catalog entry when configured slug is missing", () => {
    expect(resolveOpenCodeDefaultChatModel("missing/provider", catalog)).toBe(
      "anthropic/claude-sonnet-4",
    );
    expect(resolveOpenCodeDefaultChatModel("", catalog)).toBe("anthropic/claude-sonnet-4");
  });

  it("returns empty string when catalog is empty", () => {
    expect(resolveOpenCodeDefaultChatModel("anthropic/claude-sonnet-4", [])).toBe("");
  });
});

describe("groupModelOptionsByUpstreamProvider", () => {
  it("groups options by upstream provider metadata", () => {
    const groups = groupModelOptionsByUpstreamProvider([
      {
        slug: "openai/gpt-5",
        name: "GPT-5",
        upstreamProviderId: "openai",
        upstreamProviderName: "OpenAI",
      },
      {
        slug: "anthropic/claude-sonnet-4",
        name: "Claude Sonnet 4",
        upstreamProviderId: "anthropic",
        upstreamProviderName: "Anthropic",
      },
      {
        slug: "openai/gpt-4",
        name: "GPT-4",
        upstreamProviderId: "openai",
        upstreamProviderName: "OpenAI",
      },
    ]);
    expect(groups.map((group) => group.id)).toEqual(["anthropic", "openai"]);
    expect(groups[1]?.models).toHaveLength(2);
  });
});
