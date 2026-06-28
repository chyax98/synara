import { describe, expect, it } from "vitest";

import {
  buildOpenCodeModelCatalogOptions,
  flattenModelsFromCatalogOverview,
} from "./openCodeModelCatalog";

describe("flattenModelsFromCatalogOverview", () => {
  it("flattens SDK provider.list models", () => {
    const models = flattenModelsFromCatalogOverview({
      availability: {
        all: [
          {
            id: "anthropic",
            name: "Anthropic",
            models: {
              "claude-sonnet-4": { name: "Claude Sonnet 4" },
            },
          },
        ],
        connected: ["anthropic"],
        default: {},
      },
    });
    expect(models).toEqual([
      {
        slug: "anthropic/claude-sonnet-4",
        name: "Claude Sonnet 4",
        upstreamProviderId: "anthropic",
        upstreamProviderName: "Anthropic",
      },
    ]);
  });
});

describe("buildOpenCodeModelCatalogOptions", () => {
  it("merges dynamic models and filters hidden slugs", () => {
    const { catalogOptions, visibleOptions } = buildOpenCodeModelCatalogOptions({
      customOpenCodeModels: [],
      dynamicModels: [
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
      ],
      hiddenModels: [{ providerID: "openai", modelID: "gpt-5" }],
    });

    expect(catalogOptions.map((option) => option.slug)).toEqual(
      expect.arrayContaining(["openai/gpt-5", "anthropic/claude-sonnet-4"]),
    );
    expect(visibleOptions.map((option) => option.slug)).toEqual(["anthropic/claude-sonnet-4"]);
  });

  it("keeps the active model hint visible even when hidden", () => {
    const { visibleOptions } = buildOpenCodeModelCatalogOptions({
      customOpenCodeModels: [],
      dynamicModels: [
        {
          slug: "openai/gpt-5",
          name: "GPT-5",
          upstreamProviderId: "openai",
          upstreamProviderName: "OpenAI",
        },
      ],
      hiddenModels: [{ providerID: "openai", modelID: "gpt-5" }],
      modelHint: "openai/gpt-5",
    });

    expect(visibleOptions.map((option) => option.slug)).toEqual(["openai/gpt-5"]);
  });
});
