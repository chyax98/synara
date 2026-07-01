import { describe, expect, it } from "vitest";

import {
  configuredProviderIdsFromConfigProviders,
  mergeCatalogAvailabilityWithConfigProviders,
  modelOptionsFromConfigProviders,
  splitConfiguredSidebarGroups,
} from "./mergeConfigProvidersIntoCatalog";

describe("mergeConfigProvidersIntoCatalog", () => {
  it("adds config/custom providers missing from provider.list availability", () => {
    expect(
      mergeCatalogAvailabilityWithConfigProviders(
        [{ id: "anthropic", name: "Anthropic" }],
        [
          {
            id: "my-proxy",
            name: "My Proxy",
            source: "config",
            models: { "gpt-4o": { name: "GPT-4o" } },
          },
        ],
      ),
    ).toEqual([
      { id: "anthropic", name: "Anthropic" },
      { id: "my-proxy", name: "My Proxy" },
    ]);
  });

  it("exposes model slugs for config-only providers", () => {
    expect(
      modelOptionsFromConfigProviders([
        {
          id: "my-proxy",
          name: "My Proxy",
          source: "config",
          models: { "gpt-4o": { name: "GPT-4o" } },
        },
      ]),
    ).toEqual([
      {
        slug: "my-proxy/gpt-4o",
        name: "GPT-4o",
        upstreamProviderId: "my-proxy",
        upstreamProviderName: "My Proxy",
      },
    ]);
  });

  it("tracks configured provider ids for sidebar sections", () => {
    expect(
      configuredProviderIdsFromConfigProviders([
        { id: "api-one", name: "API", source: "api" },
        { id: "my-proxy", name: "Proxy", source: "config" },
      ]),
    ).toEqual(new Set(["my-proxy"]));
  });

  it("simulates post-upsert client merge pipeline for sidebar sections", () => {
    const sdkAvailability = [{ id: "anthropic", name: "Anthropic" }];
    const configProviders = [
      {
        id: "my-proxy",
        name: "My Proxy",
        source: "config" as const,
        models: { "gpt-4o": { name: "GPT-4o" } },
      },
    ];

    const mergedAvailability = mergeCatalogAvailabilityWithConfigProviders(
      sdkAvailability,
      configProviders,
    );
    expect(mergedAvailability.map((provider) => provider.id)).toEqual(["anthropic", "my-proxy"]);

    const configuredProviderIds = configuredProviderIdsFromConfigProviders(configProviders);
    const unconnectedProviders = mergedAvailability.map((provider) => ({
      id: provider.id,
      name: provider.name,
      models: [],
    }));
    const { configuredOnlyProviders, discoverableUnconnectedProviders } =
      splitConfiguredSidebarGroups({
        unconnectedProviders,
        discoverableAvailabilityIds: new Set(sdkAvailability.map((provider) => provider.id)),
        configuredProviderIds,
      });

    expect(configuredOnlyProviders.map((group) => group.id)).toEqual(["my-proxy"]);
    expect(discoverableUnconnectedProviders.map((group) => group.id)).toEqual(["anthropic"]);
    expect(modelOptionsFromConfigProviders(configProviders).map((option) => option.slug)).toEqual([
      "my-proxy/gpt-4o",
    ]);
  });

  it("splits unconnected groups into configured-only vs discoverable", () => {
    const { configuredOnlyProviders, discoverableUnconnectedProviders } =
      splitConfiguredSidebarGroups({
        unconnectedProviders: [
          { id: "my-proxy", name: "My Proxy", models: [] },
          { id: "anthropic", name: "Anthropic", models: [] },
        ],
        discoverableAvailabilityIds: new Set(["anthropic"]),
        configuredProviderIds: new Set(["my-proxy"]),
      });

    expect(configuredOnlyProviders.map((group) => group.id)).toEqual(["my-proxy"]);
    expect(discoverableUnconnectedProviders.map((group) => group.id)).toEqual(["anthropic"]);
  });
});
