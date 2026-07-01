// FILE: mergeConfigProvidersIntoCatalog.ts
// Purpose: Merge config.providers entries into catalog sidebar when provider.list lags.
// Layer: Web OpenCode catalog helpers

import type { OpenCodeCatalogProvider } from "@t3tools/contracts";

import type { ModelCatalogProviderGroup, ModelCatalogProviderRef } from "./modelCatalogSettings";
import type { ProviderModelOption } from "../providerModelOptions";

export function mergeCatalogAvailabilityWithConfigProviders(
  availability: ReadonlyArray<ModelCatalogProviderRef>,
  configProviders: ReadonlyArray<OpenCodeCatalogProvider>,
): ModelCatalogProviderRef[] {
  const merged = [...availability];
  const seen = new Set(availability.map((entry) => entry.id));

  for (const provider of configProviders) {
    if (provider.source !== "config" && provider.source !== "custom") {
      continue;
    }
    const id = provider.id.trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    merged.push({
      id,
      name: provider.name.trim() || id,
    });
  }

  return merged;
}

export function modelOptionsFromConfigProviders(
  configProviders: ReadonlyArray<OpenCodeCatalogProvider>,
): ProviderModelOption[] {
  const options: ProviderModelOption[] = [];
  const seen = new Set<string>();

  for (const provider of configProviders) {
    if (provider.source !== "config" && provider.source !== "custom") {
      continue;
    }
    const models = provider.models;
    if (!models || typeof models !== "object") {
      continue;
    }
    for (const [modelId, meta] of Object.entries(models)) {
      const slug = `${provider.id}/${modelId}`;
      if (seen.has(slug)) {
        continue;
      }
      seen.add(slug);
      const name =
        typeof meta === "object" &&
        meta !== null &&
        "name" in meta &&
        typeof meta.name === "string" &&
        meta.name.trim().length > 0
          ? meta.name.trim()
          : modelId;
      options.push({
        slug,
        name,
        upstreamProviderId: provider.id,
        upstreamProviderName: provider.name,
      });
    }
  }

  return options;
}

export function configuredProviderIdsFromConfigProviders(
  configProviders: ReadonlyArray<OpenCodeCatalogProvider>,
): ReadonlySet<string> {
  return new Set(
    configProviders
      .filter((provider) => provider.source === "config" || provider.source === "custom")
      .map((provider) => provider.id.trim())
      .filter((id) => id.length > 0),
  );
}

/** Split unconnected sidebar groups into opencode.json-only vs provider.list discoverable. */
export function splitConfiguredSidebarGroups(input: {
  unconnectedProviders: ReadonlyArray<ModelCatalogProviderGroup>;
  discoverableAvailabilityIds: ReadonlySet<string>;
  configuredProviderIds: ReadonlySet<string>;
}): {
  configuredOnlyProviders: ModelCatalogProviderGroup[];
  discoverableUnconnectedProviders: ModelCatalogProviderGroup[];
} {
  const configuredOnlyProviders: ModelCatalogProviderGroup[] = [];
  const discoverableUnconnectedProviders: ModelCatalogProviderGroup[] = [];

  for (const group of input.unconnectedProviders) {
    const isConfiguredOnly =
      input.configuredProviderIds.has(group.id) && !input.discoverableAvailabilityIds.has(group.id);
    if (isConfiguredOnly) {
      configuredOnlyProviders.push(group);
      continue;
    }
    discoverableUnconnectedProviders.push(group);
  }

  return { configuredOnlyProviders, discoverableUnconnectedProviders };
}
