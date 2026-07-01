import { describe, expect, it } from "vitest";

import {
  buildAddProviderModelConfigPatch,
  buildCustomProviderConfigPatch,
  buildRemoveProviderModelConfigPatch,
  parseProviderModelSlug,
} from "./openCodeCatalogMutations.ts";

describe("openCodeCatalogMutations", () => {
  it("builds custom provider config patch", () => {
    expect(
      buildCustomProviderConfigPatch({
        providerID: "my-proxy",
        name: "My Proxy",
        baseURL: "https://api.example.com/v1",
        models: [{ id: "gpt-4o", name: "GPT-4o" }],
      }),
    ).toEqual({
      provider: {
        "my-proxy": {
          npm: "@ai-sdk/openai-compatible",
          name: "My Proxy",
          options: { baseURL: "https://api.example.com/v1" },
          models: { "gpt-4o": { name: "GPT-4o" } },
        },
      },
    });
  });

  it("builds add/remove model patches", () => {
    const addPatch = buildAddProviderModelConfigPatch({
      providerID: "anthropic",
      modelID: "claude-sonnet-4",
      displayName: "Sonnet",
    });
    expect(addPatch).toEqual({
      provider: {
        anthropic: { models: { "claude-sonnet-4": { name: "Sonnet" } } },
      },
    });

    const removePatch = buildRemoveProviderModelConfigPatch({
      providerID: "anthropic",
      modelID: "claude-sonnet-4",
      existingProviderConfig: {
        models: { "claude-sonnet-4": { name: "Sonnet" }, "claude-opus-4": { name: "Opus" } },
      },
    });
    expect(removePatch?.provider).toEqual({
      anthropic: {
        models: { "claude-opus-4": { name: "Opus" } },
      },
    });
  });

  it("parses provider/model slugs", () => {
    expect(parseProviderModelSlug("anthropic/claude-sonnet-4")).toEqual({
      providerID: "anthropic",
      modelID: "claude-sonnet-4",
    });
    expect(parseProviderModelSlug("bad")).toBeNull();
  });
});
