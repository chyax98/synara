// FILE: openCodeModelCatalog.ts
// Purpose: Merge OpenCode SDK catalog models with user-added slugs and apply visibility prefs.
// Layer: Web catalog helpers
// Depends on: modelCatalogSettings, providerModelOptions.

import type { OpenCodeCatalogOverviewResult, ProviderModelDescriptor } from "@t3tools/contracts";

import {
  filterVisibleModelOptions,
  parseOpenCodeModelSlug,
  type HiddenModelRef,
} from "~/lib/modelCatalogSettings";
import {
  formatProviderModelOptionName,
  mergeDynamicModelOptions,
  type ProviderModelOption,
} from "~/providerModelOptions";

type OpenCodeDynamicModel = Pick<
  ProviderModelDescriptor,
  "slug" | "name" | "upstreamProviderId" | "upstreamProviderName"
>;

function readCatalogModelName(model: unknown, fallback: string): string {
  if (model && typeof model === "object" && "name" in model) {
    const name = (model as { name?: unknown }).name;
    if (typeof name === "string" && name.trim().length > 0) {
      return name.trim();
    }
  }
  return fallback;
}

/** Flatten models from OpenCode SDK `provider.list` payload (catalog overview). */
export function flattenModelsFromCatalogOverview(
  overview: Pick<OpenCodeCatalogOverviewResult, "availability">,
): OpenCodeDynamicModel[] {
  const models: OpenCodeDynamicModel[] = [];
  const seen = new Set<string>();

  for (const provider of overview.availability.all) {
    const providerModels = provider.models;
    if (!providerModels || typeof providerModels !== "object") {
      continue;
    }
    for (const [modelId, modelDef] of Object.entries(providerModels)) {
      const trimmedId = modelId.trim();
      const providerId = provider.id.trim();
      if (!trimmedId || !providerId) {
        continue;
      }
      const slug = `${providerId}/${trimmedId}`;
      if (seen.has(slug)) {
        continue;
      }
      seen.add(slug);
      models.push({
        slug,
        name: readCatalogModelName(modelDef, trimmedId),
        upstreamProviderId: providerId,
        upstreamProviderName: provider.name.trim() || providerId,
      });
    }
  }

  return models.toSorted((left, right) => left.name.localeCompare(right.name, "zh-CN"));
}

function customModelDescriptors(customSlugs: readonly string[]): OpenCodeDynamicModel[] {
  const descriptors: OpenCodeDynamicModel[] = [];
  const seen = new Set<string>();

  for (const rawSlug of customSlugs) {
    const slug = rawSlug.trim();
    if (!slug || seen.has(slug) || !parseOpenCodeModelSlug(slug)) {
      continue;
    }
    seen.add(slug);
    const parsed = parseOpenCodeModelSlug(slug)!;
    descriptors.push({
      slug,
      name: formatProviderModelOptionName({ provider: "opencode", slug }),
      upstreamProviderId: parsed.providerID,
      upstreamProviderName: parsed.providerID,
    });
  }

  return descriptors;
}

export function buildOpenCodeModelCatalogOptions(input: {
  customOpenCodeModels: readonly string[];
  dynamicModels: ReadonlyArray<OpenCodeDynamicModel>;
  hiddenModels: ReadonlyArray<HiddenModelRef>;
  modelHint?: string | null;
}): {
  catalogOptions: ReadonlyArray<ProviderModelOption & { isCustom?: boolean }>;
  visibleOptions: ReadonlyArray<ProviderModelOption & { isCustom?: boolean }>;
} {
  const mergedModels = [
    ...input.dynamicModels,
    ...customModelDescriptors(input.customOpenCodeModels),
  ];
  const catalogOptions = mergeDynamicModelOptions({
    provider: "opencode",
    staticOptions: [],
    dynamicModels: mergedModels,
  });
  const visibleOptions = filterVisibleModelOptions(catalogOptions, input.hiddenModels, {
    alwaysIncludeSlug: input.modelHint ?? null,
  });
  return { catalogOptions, visibleOptions };
}
