import {
  formatModelDisplayName,
  humanizeModelSlug,
  normalizeModelSlug,
} from "@t3tools/shared/model";
import type {
  ModelSelection,
  OpenCodeModelOptions,
  OpenCodeModelSelection,
  ProviderKind,
  ProviderModelOptions,
} from "@t3tools/contracts";

export type ProviderOptions = ProviderModelOptions[ProviderKind];

export interface ProviderModelOption {
  slug: string;
  name: string;
  upstreamProviderId?: string;
  upstreamProviderName?: string;
}

export interface ProviderModelOptionGroup {
  key: string;
  label: string | null;
  options: ProviderModelOption[];
}

function modelOptionKey(option: Pick<ProviderModelOption, "slug">): string {
  return option.slug.trim().toLowerCase();
}

export function formatProviderModelOptionName(input: {
  provider: ProviderKind;
  slug: string;
}): string {
  const trimmedSlug = input.slug.trim();
  if (trimmedSlug.length === 0) {
    return trimmedSlug;
  }

  const modelIdentifier = trimmedSlug.includes("/")
    ? trimmedSlug.slice(trimmedSlug.lastIndexOf("/") + 1)
    : trimmedSlug;
  return formatModelDisplayName(modelIdentifier) ?? humanizeModelSlug(modelIdentifier);
}

export function mergeProviderModelOptions(
  preferred: ReadonlyArray<ProviderModelOption>,
  fallback: ReadonlyArray<ProviderModelOption>,
): ProviderModelOption[] {
  const merged = [...preferred];
  const seen = new Set(preferred.map((option) => modelOptionKey(option)));

  for (const option of fallback) {
    const key = modelOptionKey(option);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(option);
  }

  return merged;
}

function normalizeDynamicModelSlug(slug: string): string {
  return normalizeModelSlug(slug, "opencode") ?? slug.trim();
}

export function mergeDynamicModelOptions(input: {
  provider: ProviderKind;
  staticOptions: ReadonlyArray<ProviderModelOption & { isCustom?: boolean }>;
  dynamicModels: ReadonlyArray<{
    slug: string;
    name?: string | null | undefined;
    upstreamProviderId?: string | null | undefined;
    upstreamProviderName?: string | null | undefined;
  }>;
}): ReadonlyArray<ProviderModelOption & { isCustom?: boolean }> {
  const staticNameBySlug = new Map(input.staticOptions.map((model) => [model.slug, model.name]));
  const dynamicNormalizedSlugs = new Set<string>();
  const normalizedDynamicOptions: ProviderModelOption[] = [];

  for (const dynamicModel of input.dynamicModels) {
    const rawName = dynamicModel.name?.trim() ?? "";
    const normalizedSlug = normalizeDynamicModelSlug(dynamicModel.slug);
    const rawSlug = dynamicModel.slug.trim().toLowerCase();
    const displayNameFallback = formatProviderModelOptionName({
      provider: input.provider,
      slug: normalizedSlug,
    });
    if (dynamicNormalizedSlugs.has(normalizedSlug)) {
      continue;
    }
    dynamicNormalizedSlugs.add(normalizedSlug);
    normalizedDynamicOptions.push({
      slug: normalizedSlug,
      name:
        staticNameBySlug.get(normalizedSlug) ??
        (rawName.length > 0 &&
        rawName.toLowerCase() !== rawSlug &&
        rawName.toLowerCase() !== normalizedSlug.toLowerCase()
          ? rawName
          : displayNameFallback),
      ...(dynamicModel.upstreamProviderId?.trim()
        ? { upstreamProviderId: dynamicModel.upstreamProviderId.trim() }
        : {}),
      ...(dynamicModel.upstreamProviderName?.trim()
        ? { upstreamProviderName: dynamicModel.upstreamProviderName.trim() }
        : {}),
    });
  }

  const customOnlyModels = input.staticOptions.filter(
    (model) => "isCustom" in model && model.isCustom && !dynamicNormalizedSlugs.has(model.slug),
  );
  const staticBuiltInModels = input.staticOptions.filter(
    (model) => !("isCustom" in model) || model.isCustom !== true,
  );
  const missingStaticBuiltIns =
    normalizedDynamicOptions.length > 0
      ? []
      : staticBuiltInModels.filter((model) => !dynamicNormalizedSlugs.has(model.slug));

  return [...normalizedDynamicOptions.toReversed(), ...missingStaticBuiltIns, ...customOnlyModels];
}

export function groupProviderModelOptions(
  options: ReadonlyArray<ProviderModelOption>,
): ProviderModelOptionGroup[] {
  const groupedOptions: ProviderModelOptionGroup[] = [];
  const groupIndexByKey = new Map<string, number>();

  for (const option of options) {
    const upstreamProviderId = option.upstreamProviderId?.trim();
    const upstreamProviderName = option.upstreamProviderName?.trim();
    const groupLabel =
      upstreamProviderName && upstreamProviderName.length > 0
        ? upstreamProviderName
        : upstreamProviderId && upstreamProviderId.length > 0
          ? upstreamProviderId
          : null;
    const groupKey = groupLabel
      ? `${(upstreamProviderId ?? groupLabel).trim().toLowerCase()}`
      : "__ungrouped__";
    const existingIndex = groupIndexByKey.get(groupKey);

    if (existingIndex !== undefined) {
      groupedOptions[existingIndex]!.options.push(option);
      continue;
    }

    groupIndexByKey.set(groupKey, groupedOptions.length);
    groupedOptions.push({
      key: groupKey,
      label: groupLabel,
      options: [option],
    });
  }

  return groupedOptions;
}

export function groupProviderModelOptionsWithFavorites(input: {
  options: ReadonlyArray<ProviderModelOption>;
  favoriteSlugs: ReadonlySet<string>;
  favoriteLabel?: string;
}): ProviderModelOptionGroup[] {
  return groupProviderModelOptionsWithPrefs({
    options: input.options,
    favoriteSlugs: input.favoriteSlugs,
    recentSlugs: [] as const,
    ...(input.favoriteLabel !== undefined ? { favoriteLabel: input.favoriteLabel } : {}),
  });
}

export function groupProviderModelOptionsWithPrefs(input: {
  options: ReadonlyArray<ProviderModelOption>;
  favoriteSlugs: ReadonlySet<string>;
  recentSlugs: ReadonlyArray<string>;
  favoriteLabel?: string;
  recentLabel?: string;
}): ProviderModelOptionGroup[] {
  const optionBySlug = new Map(input.options.map((option) => [option.slug, option]));
  const reservedSlugs = new Set<string>();

  const favoriteOptions = [...input.favoriteSlugs]
    .map((slug) => optionBySlug.get(slug))
    .filter((option): option is ProviderModelOption => option !== undefined);
  for (const option of favoriteOptions) {
    reservedSlugs.add(option.slug);
  }

  const recentOptions = input.recentSlugs
    .map((slug) => optionBySlug.get(slug))
    .filter((option): option is ProviderModelOption => {
      if (!option || reservedSlugs.has(option.slug)) {
        return false;
      }
      reservedSlugs.add(option.slug);
      return true;
    });

  const remainingOptions = input.options.filter((option) => !reservedSlugs.has(option.slug));
  const groupedOptions = groupProviderModelOptions(remainingOptions);

  const sections: ProviderModelOptionGroup[] = [];
  if (favoriteOptions.length > 0) {
    sections.push({
      key: "__favorites__",
      label: input.favoriteLabel ?? "收藏",
      options: favoriteOptions,
    });
  }
  if (recentOptions.length > 0) {
    sections.push({
      key: "__recent__",
      label: input.recentLabel ?? "最近",
      options: recentOptions,
    });
  }
  return [...sections, ...groupedOptions];
}

export const COLLAPSIBLE_MODEL_GROUP_THRESHOLD = 3;

export function shouldUseCollapsibleModelGroups(groupCount: number, isSearching: boolean): boolean {
  return groupCount >= COLLAPSIBLE_MODEL_GROUP_THRESHOLD && !isSearching;
}

export function resolveModelGroupDefaultOpen(input: {
  groupKey: string;
  options: ReadonlyArray<ProviderModelOption>;
  activeModel: string;
  groupCount: number;
}): boolean {
  if (input.groupCount < COLLAPSIBLE_MODEL_GROUP_THRESHOLD) {
    return true;
  }
  if (input.groupKey === "__favorites__") {
    return true;
  }
  return input.options.some((option) => option.slug === input.activeModel);
}

export function buildNextProviderOptions(
  _provider: ProviderKind,
  modelOptions: ProviderOptions | null | undefined,
  patch: Record<string, unknown>,
): ProviderOptions {
  return {
    ...(modelOptions as OpenCodeModelOptions | undefined),
    ...patch,
  } as OpenCodeModelOptions;
}

export function buildProviderOptionPatch(
  _provider: ProviderKind,
  optionId: string,
  value: string | boolean,
): Record<string, unknown> {
  return { [optionId]: value };
}

export function buildModelSelection(
  provider: ProviderKind,
  model: string,
  options?: ProviderOptions | null | undefined,
): ModelSelection {
  return options
    ? {
        provider: "opencode",
        model,
        options: options as OpenCodeModelOptions,
      }
    : { provider: "opencode", model };
}
