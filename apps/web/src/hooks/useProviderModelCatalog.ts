// FILE: useProviderModelCatalog.ts
// Purpose: OpenCode composer catalog projection (models, agents, runtime descriptors).
// Layer: Web hooks

import type {
  ProviderAgentDescriptor,
  ProviderKind,
  ProviderModelDescriptor,
} from "@t3tools/contracts";
import { useMemo } from "react";

import { resolveRuntimeModelDescriptor } from "../components/chat/runtimeModelCapabilities";
import { type ProviderModelOption } from "../providerModelOptions";
import { useOpenCodeModelCatalog } from "./useOpenCodeModelCatalog";

export interface OpenCodeModelCatalogView {
  modelOptions: ReadonlyArray<ProviderModelOption & { isCustom?: boolean }>;
  runtimeModels: ReadonlyArray<ProviderModelDescriptor>;
  agents: ReadonlyArray<ProviderAgentDescriptor>;
  isDiscoveryPending: boolean;
  overviewQuery: ReturnType<typeof useOpenCodeModelCatalog>["overviewQuery"];
  selectedRuntimeModel: ProviderModelDescriptor | undefined;
}

/** OpenCode-only composer projection; Record keys exist only for legacy picker props. */
export interface ProviderModelCatalog extends OpenCodeModelCatalogView {
  modelOptionsByProvider: Record<
    ProviderKind,
    ReadonlyArray<ProviderModelOption & { isCustom?: boolean }>
  >;
  loadingModelProviders: Partial<Record<ProviderKind, boolean>>;
  runtimeModelsByProvider: Record<ProviderKind, ReadonlyArray<ProviderModelDescriptor>>;
  selectedRuntimeAgents: ReadonlyArray<ProviderAgentDescriptor>;
  modelsQueryByProvider: Partial<
    Record<ProviderKind, ReturnType<typeof useOpenCodeModelCatalog>["overviewQuery"]>
  >;
}

const EMPTY_AGENTS: ReadonlyArray<ProviderAgentDescriptor> = [];

export function useProviderModelCatalog(input: {
  discoveryEnabled: boolean;
  cwd?: string | null;
  modelHint?: string | null;
  selectedModel?: string | null;
  /** Legacy: ignored — OpenCode-only fork always discovers opencode. */
  selectedProvider?: ProviderKind;
  modelHintByProvider?: Partial<Record<ProviderKind, string | null>>;
  selectedModelByProvider?: Partial<Record<ProviderKind, string | null>>;
}): ProviderModelCatalog {
  const modelHint = input.modelHint ?? input.modelHintByProvider?.opencode ?? null;
  const selectedModel =
    input.selectedModel ??
    input.selectedModelByProvider?.opencode ??
    input.modelHintByProvider?.opencode ??
    null;

  const catalog = useOpenCodeModelCatalog({
    cwd: input.cwd ?? null,
    enabled: input.discoveryEnabled,
    modelHint,
  });

  const selectedRuntimeModel = useMemo(
    () =>
      resolveRuntimeModelDescriptor({
        provider: "opencode",
        model: selectedModel,
        runtimeModels: catalog.dynamicModels,
      }),
    [catalog.dynamicModels, selectedModel],
  );

  const agents = catalog.catalogAgents.length > 0 ? catalog.catalogAgents : EMPTY_AGENTS;

  return {
    modelOptions: catalog.visibleOptions,
    runtimeModels: catalog.dynamicModels,
    agents,
    isDiscoveryPending: catalog.isDiscoveryPending,
    overviewQuery: catalog.overviewQuery,
    selectedRuntimeModel,
    modelOptionsByProvider: {
      opencode: catalog.visibleOptions,
    },
    loadingModelProviders: {
      opencode: catalog.isDiscoveryPending,
    },
    runtimeModelsByProvider: {
      opencode: catalog.dynamicModels,
    },
    selectedRuntimeAgents: agents,
    modelsQueryByProvider: {
      opencode: catalog.overviewQuery,
    },
  };
}
