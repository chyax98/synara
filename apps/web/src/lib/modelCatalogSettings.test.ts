import { describe, expect, it } from "vitest";

import {
  filterVisibleModelOptions,
  resolveCatalogModelSelection,
  resolveOpenCodeDefaultChatModel,
  toggleHiddenModelRef,
} from "./modelCatalogSettings";

describe("toggleHiddenModelRef", () => {
  it("adds and removes hidden model refs by provider/model id", () => {
    const ref = { providerID: "anthropic", modelID: "claude-sonnet-4" };
    const hidden = toggleHiddenModelRef([], ref, false);
    console.info("OBSERVATION: toggleHidden.added", JSON.stringify(hidden));
    expect(hidden).toEqual([ref]);

    const visible = toggleHiddenModelRef(hidden, ref, true);
    console.info("OBSERVATION: toggleHidden.removed", JSON.stringify(visible));
    expect(visible).toEqual([]);
  });

  it("filters visible catalog options when slug is hidden", () => {
    const ref = { providerID: "anthropic", modelID: "claude-sonnet-4" };
    const hiddenModels = toggleHiddenModelRef([], ref, false);
    const visible = filterVisibleModelOptions(
      [
        { slug: "anthropic/claude-sonnet-4", name: "Sonnet" },
        { slug: "openai/gpt-5", name: "GPT-5" },
      ],
      hiddenModels,
    );
    console.info(
      "OBSERVATION: filterVisible.afterHide",
      JSON.stringify(visible.map((m) => m.slug)),
    );
    expect(visible.map((option) => option.slug)).toEqual(["openai/gpt-5"]);
  });
});

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
