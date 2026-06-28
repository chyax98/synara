// FILE: openCodeModelCatalog.ts
// Purpose: Project OpenCode catalog overview into picker options and runtime descriptors.
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

type OpenCodeDynamicModel = ProviderModelDescriptor;

function readCatalogModelName(model: unknown, fallback: string): string {
  if (model && typeof model === "object" && "name" in model) {
    const name = (model as { name?: unknown }).name;
    if (typeof name === "string" && name.trim().length > 0) {
      return name.trim();
    }
  }
  return fallback;
}

function readReasoningEfforts(
  model: unknown,
): ProviderModelDescriptor["supportedReasoningEfforts"] {
  if (!model || typeof model !== "object") {
    return undefined;
  }
  const object = model as Record<string, unknown>;
  const reasoning = object.reasoning;
  if (reasoning === true) {
    return [{ value: "medium", label: "中" }];
  }
  if (Array.isArray(reasoning)) {
    const efforts = reasoning
      .map((entry) => {
        if (typeof entry === "string" && entry.trim().length > 0) {
          return { value: entry.trim() };
        }
        if (entry && typeof entry === "object" && "value" in entry) {
          const value = (entry as { value?: unknown }).value;
          if (typeof value === "string" && value.trim().length > 0) {
            const label = (entry as { label?: unknown }).label;
            return {
              value: value.trim(),
              ...(typeof label === "string" && label.trim().length > 0
                ? { label: label.trim() }
                : {}),
            };
          }
        }
        return null;
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    return efforts.length > 0 ? efforts : undefined;
  }
  return undefined;
}

function readContextWindowOptions(model: unknown): ProviderModelDescriptor["contextWindowOptions"] {
  if (!model || typeof model !== "object") {
    return undefined;
  }
  const limit = (model as { limit?: unknown }).limit;
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    const label = `${Math.round(limit / 1000)}K`;
    return [{ value: String(limit), label }];
  }
  if (typeof limit === "string" && limit.trim().length > 0) {
    return [{ value: limit.trim(), label: limit.trim() }];
  }
  return undefined;
}

/** Fallback flatten when server overview.models is absent (tests / legacy). */
export function flattenModelsFromCatalogOverview(
  overview: Pick<OpenCodeCatalogOverviewResult, "availability" | "models">,
): OpenCodeDynamicModel[] {
  if (overview.models && overview.models.length > 0) {
    return [...overview.models];
  }

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
        ...(() => {
          const supportedReasoningEfforts = readReasoningEfforts(modelDef);
          const contextWindowOptions = readContextWindowOptions(modelDef);
          return {
            ...(supportedReasoningEfforts ? { supportedReasoningEfforts } : {}),
            ...(contextWindowOptions ? { contextWindowOptions } : {}),
          };
        })(),
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
