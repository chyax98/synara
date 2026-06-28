// FILE: modelCatalogSettings.ts
// Purpose: Parse OpenCode model slugs and manage per-model visibility in AppSettings.
// Layer: Web settings + composer helpers
// Depends on: provider model option shape from runtime discovery

import type { ProviderModelOption } from "../providerModelOptions";

export type HiddenModelRef = {
  providerID: string;
  modelID: string;
};

export type ModelCatalogProviderGroup = {
  id: string;
  name: string;
  models: ReadonlyArray<ProviderModelOption>;
};

export function normalizeHiddenModelRefs(
  refs: ReadonlyArray<Partial<HiddenModelRef> | null | undefined>,
): HiddenModelRef[] {
  const normalized: HiddenModelRef[] = [];
  const seen = new Set<string>();

  for (const candidate of refs) {
    const providerID = candidate?.providerID?.trim() ?? "";
    const modelID = candidate?.modelID?.trim() ?? "";
    if (!providerID || !modelID) {
      continue;
    }
    const ref = { providerID, modelID };
    const key = hiddenModelKey(ref);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(ref);
  }

  return normalized;
}

export function parseOpenCodeModelSlug(slug: string): HiddenModelRef | null {
  const trimmed = slug.trim();
  const separatorIndex = trimmed.indexOf("/");
  if (separatorIndex <= 0 || separatorIndex >= trimmed.length - 1) {
    return null;
  }
  return {
    providerID: trimmed.slice(0, separatorIndex),
    modelID: trimmed.slice(separatorIndex + 1),
  };
}

export function hiddenModelKey(ref: HiddenModelRef): string {
  return `${ref.providerID}/${ref.modelID}`;
}

export function isModelSlugHidden(
  slug: string,
  hiddenModels: ReadonlyArray<HiddenModelRef>,
): boolean {
  const parsed = parseOpenCodeModelSlug(slug);
  if (!parsed) {
    return false;
  }
  return hiddenModels.some(
    (entry) => entry.providerID === parsed.providerID && entry.modelID === parsed.modelID,
  );
}

export function filterVisibleModelOptions<T extends Pick<ProviderModelOption, "slug">>(
  options: ReadonlyArray<T>,
  hiddenModels: ReadonlyArray<HiddenModelRef>,
  input?: { alwaysIncludeSlug?: string | null },
): ReadonlyArray<T> {
  const alwaysInclude = input?.alwaysIncludeSlug?.trim() ?? "";
  if (hiddenModels.length === 0) {
    return options;
  }
  return options.filter(
    (option) =>
      (alwaysInclude.length > 0 && option.slug === alwaysInclude) ||
      !isModelSlugHidden(option.slug, hiddenModels),
  );
}

export function toggleHiddenModelRef(
  hiddenModels: ReadonlyArray<HiddenModelRef>,
  ref: HiddenModelRef,
  visible: boolean,
): HiddenModelRef[] {
  const key = hiddenModelKey(ref);
  const without = hiddenModels.filter((entry) => hiddenModelKey(entry) !== key);
  return visible ? without : [...without, ref];
}

export function setModelsVisibilityBySlugs(
  hiddenModels: ReadonlyArray<HiddenModelRef>,
  modelSlugs: ReadonlyArray<string>,
  visible: boolean,
): HiddenModelRef[] {
  const refs = modelSlugs
    .map((slug) => parseOpenCodeModelSlug(slug))
    .filter((ref): ref is HiddenModelRef => ref !== null);
  if (refs.length === 0) {
    return [...hiddenModels];
  }
  const refKeys = new Set(refs.map(hiddenModelKey));
  const withoutTargets = hiddenModels.filter((entry) => !refKeys.has(hiddenModelKey(entry)));
  if (visible) {
    return withoutTargets;
  }
  const existing = new Set(withoutTargets.map(hiddenModelKey));
  const additions = refs.filter((ref) => !existing.has(hiddenModelKey(ref)));
  return [...withoutTargets, ...additions];
}

export function groupModelOptionsByUpstreamProvider(
  options: ReadonlyArray<ProviderModelOption>,
): ModelCatalogProviderGroup[] {
  const groups: ModelCatalogProviderGroup[] = [];
  const indexById = new Map<string, number>();

  for (const option of options) {
    const upstreamId = option.upstreamProviderId?.trim() || "__ungrouped__";
    const upstreamName =
      option.upstreamProviderName?.trim() || (upstreamId === "__ungrouped__" ? "其他" : upstreamId);
    const existingIndex = indexById.get(upstreamId);
    if (existingIndex !== undefined) {
      groups[existingIndex]!.models = [...groups[existingIndex]!.models, option];
      continue;
    }
    indexById.set(upstreamId, groups.length);
    groups.push({
      id: upstreamId,
      name: upstreamName,
      models: [option],
    });
  }

  return groups.toSorted((left, right) => left.name.localeCompare(right.name, "zh-CN"));
}

export function providerGroupVisibleCount(
  group: ModelCatalogProviderGroup,
  hiddenModels: ReadonlyArray<HiddenModelRef>,
): { visible: number; total: number } {
  const total = group.models.length;
  const visible = group.models.filter(
    (model) => !isModelSlugHidden(model.slug, hiddenModels),
  ).length;
  return { visible, total };
}

export type ModelCatalogProviderRef = {
  id: string;
  name: string;
};

export type ModelCatalogSidebar = {
  sidebarGroups: ModelCatalogProviderGroup[];
  unconnectedProviders: ModelCatalogProviderGroup[];
};

function compareCatalogProviderGroups(
  left: ModelCatalogProviderGroup,
  right: ModelCatalogProviderGroup,
  connectedIds: ReadonlySet<string>,
): number {
  const leftConnected = connectedIds.has(left.id) ? 0 : 1;
  const rightConnected = connectedIds.has(right.id) ? 0 : 1;
  if (leftConnected !== rightConnected) {
    return leftConnected - rightConnected;
  }
  return left.name.localeCompare(right.name, "zh-CN");
}

/** Merge OpenCode availability with discovered model groups into one sidebar source of truth. */
export function buildModelCatalogSidebar(input: {
  availability: ReadonlyArray<ModelCatalogProviderRef>;
  connectedIds: ReadonlySet<string>;
  modelGroups: ReadonlyArray<ModelCatalogProviderGroup>;
}): ModelCatalogSidebar {
  const modelsByProviderId = new Map(
    input.modelGroups.map((group) => [group.id, group.models] as const),
  );
  const groupsById = new Map<string, ModelCatalogProviderGroup>();

  for (const provider of input.availability) {
    const id = provider.id.trim();
    if (!id) {
      continue;
    }
    groupsById.set(id, {
      id,
      name: provider.name.trim() || id,
      models: modelsByProviderId.get(id) ?? [],
    });
  }

  for (const group of input.modelGroups) {
    if (groupsById.has(group.id)) {
      continue;
    }
    groupsById.set(group.id, group);
  }

  const sidebarGroups = [...groupsById.values()].toSorted((left, right) =>
    compareCatalogProviderGroups(left, right, input.connectedIds),
  );
  const unconnectedProviders = sidebarGroups.filter((group) => !input.connectedIds.has(group.id));

  return { sidebarGroups, unconnectedProviders };
}

export function filterModelCatalogGroups(
  groups: ReadonlyArray<ModelCatalogProviderGroup>,
  query: string,
): ModelCatalogProviderGroup[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [...groups];
  }
  return groups.filter((group) => group.name.toLowerCase().includes(needle));
}

/** Resolve default chat model slug against the live OpenCode catalog only. */
export function resolveOpenCodeDefaultChatModel(
  defaultChatModel: string,
  catalogOptions: ReadonlyArray<{ slug: string }> = [],
): string {
  const trimmed = defaultChatModel.trim();
  if (trimmed.length > 0 && catalogOptions.some((option) => option.slug === trimmed)) {
    return trimmed;
  }
  return catalogOptions[0]?.slug ?? "";
}

/** Pick a catalog slug for user actions; never falls back to static built-in models. */
export function resolveCatalogModelSelection(input: {
  candidate?: string | null;
  catalogOptions: ReadonlyArray<{ slug: string }>;
  defaultChatModel?: string | null;
}): string {
  const candidate = input.candidate?.trim() ?? "";
  if (candidate.length > 0 && input.catalogOptions.some((option) => option.slug === candidate)) {
    return candidate;
  }
  return resolveOpenCodeDefaultChatModel(input.defaultChatModel ?? "", input.catalogOptions);
}

export function filterModelCatalogModels(
  models: ReadonlyArray<ProviderModelOption>,
  query: string,
): ProviderModelOption[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [...models];
  }
  return models.filter((model) => {
    const haystack = [model.name, model.slug, model.upstreamProviderName, model.upstreamProviderId]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}
