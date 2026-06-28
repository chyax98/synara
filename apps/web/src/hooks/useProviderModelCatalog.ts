// FILE: useProviderModelCatalog.ts
// Purpose: OpenCode model catalog for composer-like surfaces (models, agents, runtime).
// Layer: Web hooks

import type {
  ProviderAgentDescriptor,
  ProviderKind,
  ProviderModelDescriptor,
} from "@t3tools/contracts";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { resolveRuntimeModelDescriptor } from "../components/chat/runtimeModelCapabilities";
import { providerAgentsQueryOptions } from "../lib/providerDiscoveryReactQuery";
import { type ProviderModelOption } from "../providerModelOptions";
import { useOpenCodeModelCatalog } from "./useOpenCodeModelCatalog";

const OPENCODE_PROVIDER: ProviderKind = "opencode";

export interface ProviderModelCatalog {
  modelOptionsByProvider: Record<
    ProviderKind,
    ReadonlyArray<ProviderModelOption & { isCustom?: boolean }>
  >;
  loadingModelProviders: Partial<Record<ProviderKind, boolean>>;
  runtimeModelsByProvider: Record<ProviderKind, ReadonlyArray<ProviderModelDescriptor>>;
  selectedRuntimeModel: ProviderModelDescriptor | undefined;
  selectedRuntimeAgents: ReadonlyArray<ProviderAgentDescriptor>;
  modelsQueryByProvider: Partial<Record<ProviderKind, ReturnType<typeof useQuery>>>;
}

const EMPTY_PROVIDER_AGENTS: ReadonlyArray<ProviderAgentDescriptor> = [];

export function useProviderModelCatalog(input: {
  selectedProvider: ProviderKind;
  discoveryEnabled: boolean;
  cwd?: string | null;
  modelHintByProvider?: Partial<Record<ProviderKind, string | null>>;
  /** Resolved composer selection; falls back to model hint when omitted. */
  selectedModelByProvider?: Partial<Record<ProviderKind, string | null>>;
}): ProviderModelCatalog {
  const discoveryCwd = input.cwd ?? null;
  const modelHint = input.modelHintByProvider?.opencode ?? null;
  const selectedModel =
    input.selectedModelByProvider?.opencode ?? input.modelHintByProvider?.opencode ?? null;

  const catalog = useOpenCodeModelCatalog({
    cwd: discoveryCwd,
    enabled: input.discoveryEnabled,
    modelHint,
  });

  const agentsQuery = useQuery(
    providerAgentsQueryOptions({
      provider: OPENCODE_PROVIDER,
      binaryPath: catalog.connection.binaryPath,
      cwd: discoveryCwd,
      enabled: input.discoveryEnabled,
    }),
  );

  const modelOptionsByProvider = useMemo(
    () =>
      ({
        opencode: catalog.visibleOptions,
      }) as Record<ProviderKind, ReadonlyArray<ProviderModelOption & { isCustom?: boolean }>>,
    [catalog.visibleOptions],
  );

  const runtimeModelsByProvider = useMemo(
    () => ({
      opencode: catalog.dynamicModels,
    }),
    [catalog.dynamicModels],
  ) as Record<ProviderKind, ReadonlyArray<ProviderModelDescriptor>>;

  const selectedRuntimeModel = useMemo(
    () =>
      resolveRuntimeModelDescriptor({
        provider: OPENCODE_PROVIDER,
        model: selectedModel,
        runtimeModels: runtimeModelsByProvider.opencode,
      }),
    [runtimeModelsByProvider.opencode, selectedModel],
  );

  return {
    modelOptionsByProvider,
    loadingModelProviders: {
      opencode: catalog.isDiscoveryPending,
    },
    runtimeModelsByProvider,
    selectedRuntimeModel,
    selectedRuntimeAgents: agentsQuery.data?.agents ?? EMPTY_PROVIDER_AGENTS,
    modelsQueryByProvider: {
      opencode: catalog.overviewQuery,
    },
  };
}
