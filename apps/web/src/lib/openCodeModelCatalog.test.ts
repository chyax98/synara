import { describe, expect, it } from "vitest";

import {
  buildOpenCodeModelCatalogOptions,
  flattenModelsFromCatalogOverview,
} from "./openCodeModelCatalog";

const sampleOverview = {
  availability: {
    all: [
      {
        id: "anthropic",
        name: "Anthropic",
        models: {
          "claude-sonnet-4": { name: "Claude Sonnet 4", reasoning: true, limit: 200000 },
        },
      },
    ],
    connected: ["anthropic"],
    default: {},
  },
  authMethods: {},
  models: [
    {
      slug: "anthropic/claude-sonnet-4",
      name: "Claude Sonnet 4",
      upstreamProviderId: "anthropic",
      upstreamProviderName: "Anthropic",
      supportedReasoningEfforts: [{ value: "high", label: "高" }],
    },
  ],
  agents: [{ name: "build", displayName: "Build" }],
} as const;

describe("flattenModelsFromCatalogOverview", () => {
  it("prefers server-enriched overview.models", () => {
    const models = flattenModelsFromCatalogOverview(sampleOverview);
    expect(models).toHaveLength(1);
    expect(models[0]?.slug).toBe("anthropic/claude-sonnet-4");
    expect(models[0]?.supportedReasoningEfforts).toEqual([{ value: "high", label: "高" }]);
  });

  it("falls back to SDK availability payload with reasoning/limit enrichment", () => {
    const models = flattenModelsFromCatalogOverview({
      availability: sampleOverview.availability,
      models: [],
    });
    expect(models[0]?.slug).toBe("anthropic/claude-sonnet-4");
    expect(models[0]?.supportedReasoningEfforts).toEqual([{ value: "medium", label: "中" }]);
    expect(models[0]?.contextWindowOptions).toEqual([{ value: "200000", label: "200K" }]);
  });
});

describe("buildOpenCodeModelCatalogOptions", () => {
  it("merges dynamic models and filters hidden slugs", () => {
    const { catalogOptions, visibleOptions } = buildOpenCodeModelCatalogOptions({
      customOpenCodeModels: [],
      dynamicModels: flattenModelsFromCatalogOverview(sampleOverview),
      hiddenModels: [{ providerID: "openai", modelID: "gpt-5" }],
    });

    expect(catalogOptions.map((option) => option.slug)).toEqual(["anthropic/claude-sonnet-4"]);
    expect(visibleOptions.map((option) => option.slug)).toEqual(["anthropic/claude-sonnet-4"]);
  });

  it("never injects static openai/gpt-5 when catalog is empty", () => {
    const { visibleOptions } = buildOpenCodeModelCatalogOptions({
      customOpenCodeModels: [],
      dynamicModels: [],
      hiddenModels: [],
    });
    expect(visibleOptions).toEqual([]);
  });
});
