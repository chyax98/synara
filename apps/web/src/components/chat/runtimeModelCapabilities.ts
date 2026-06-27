// FILE: runtimeModelCapabilities.ts
// Purpose: Bridges runtime-discovered OpenCode model metadata into composer capabilities.
// Layer: Chat composer helpers

import type {
  EffortOption,
  ModelCapabilities,
  ProviderKind,
  ProviderModelDescriptor,
} from "@t3tools/contracts";
import { getModelCapabilities, normalizeModelSlug, trimOrNull } from "@t3tools/shared/model";

function runtimeEffortLabel(value: string): string {
  switch (value) {
    case "none":
      return "无";
    case "minimal":
      return "极低";
    case "low":
      return "低";
    case "medium":
      return "中";
    case "high":
      return "高";
    case "xhigh":
      return "极高";
    default:
      return value
        .split(/[-_\s]+/u)
        .filter((segment) => segment.length > 0)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(" ");
  }
}

export function resolveRuntimeModelDescriptor(input: {
  provider: ProviderKind;
  model: string | null | undefined;
  runtimeModels: ReadonlyArray<ProviderModelDescriptor> | null | undefined;
}): ProviderModelDescriptor | undefined {
  const { provider, model, runtimeModels } = input;
  if (!runtimeModels?.length) {
    return undefined;
  }

  const normalizedModel = normalizeModelSlug(model, provider) ?? trimOrNull(model);
  if (!normalizedModel) {
    return undefined;
  }

  return runtimeModels.find((candidate) => {
    const normalizedCandidate = normalizeModelSlug(candidate.slug, provider) ?? candidate.slug;
    return normalizedCandidate === normalizedModel;
  });
}

export function getRuntimeAwareModelCapabilities(input: {
  provider: ProviderKind;
  model: string | null | undefined;
  runtimeModel?: ProviderModelDescriptor | undefined;
}): ModelCapabilities {
  const staticCapabilities = getModelCapabilities(input.provider, input.model);
  const runtimeVariantOptions = input.runtimeModel?.supportedReasoningEfforts ?? [];
  const variantOptions: ReadonlyArray<EffortOption> =
    runtimeVariantOptions.length > 0
      ? runtimeVariantOptions.map((option) => ({
          value: option.value,
          label: option.label ?? runtimeEffortLabel(option.value),
          ...(option.description ? { description: option.description } : {}),
        }))
      : (staticCapabilities.variantOptions ?? []);

  return {
    ...staticCapabilities,
    variantOptions,
  };
}
