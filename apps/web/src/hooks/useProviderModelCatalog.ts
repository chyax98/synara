// FILE: useProviderModelCatalog.ts
// Purpose: Shared OpenCode model option catalog for composer-like surfaces.
// Layer: Web hooks
// Exports: useProviderModelCatalog, ProviderModelCatalog

import type {
  ProviderAgentDescriptor,
  ProviderKind,
  ProviderModelDescriptor,
} from "@t3tools/contracts";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { getAppModelOptions, getCustomModelsByProvider, useAppSettings } from "../appSettings";
import { resolveRuntimeModelDescriptor } from "../components/chat/runtimeModelCapabilities";
import {
  providerAgentsQueryOptions,
  providerModelsQueryOptions,
} from "../lib/providerDiscoveryReactQuery";
import { mergeDynamicModelOptions, type ProviderModelOption } from "../providerModelOptions";

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
}

const EMPTY_PROVIDER_AGENTS: ReadonlyArray<ProviderAgentDescriptor> = [];

export function useProviderModelCatalog(input: {
  selectedProvider: ProviderKind;
  discoveryEnabled: boolean;
  cwd?: string | null;
  modelHintByProvider?: Partial<Record<ProviderKind, string | null>>;
}): ProviderModelCatalog {
  const { discoveryEnabled, modelHintByProvider } = input;
  const discoveryCwd = input.cwd ?? null;
  const { settings } = useAppSettings();
  const customModelsByProvider = useMemo(() => getCustomModelsByProvider(settings), [settings]);

  const openCodeDynamicModelsQuery = useQuery(
    providerModelsQueryOptions({
      provider: OPENCODE_PROVIDER,
      binaryPath: settings.openCodeBinaryPath || null,
      cwd: discoveryCwd,
      enabled: discoveryEnabled,
    }),
  );
  const openCodeDynamicAgentsQuery = useQuery(
    providerAgentsQueryOptions({
      provider: OPENCODE_PROVIDER,
      binaryPath: settings.openCodeBinaryPath || null,
      cwd: discoveryCwd,
      enabled: discoveryEnabled,
    }),
  );

  const staticOptions = useMemo(
    () =>
      getAppModelOptions(
        OPENCODE_PROVIDER,
        customModelsByProvider.opencode,
        modelHintByProvider?.opencode,
      ),
    [customModelsByProvider.opencode, modelHintByProvider?.opencode],
  );

  const dynamicModels = openCodeDynamicModelsQuery.data?.models ?? [];
  const modelOptionsByProvider = useMemo(
    () => ({
      opencode: mergeDynamicModelOptions({
        provider: OPENCODE_PROVIDER,
        staticOptions,
        dynamicModels,
      }),
    }),
    [dynamicModels, staticOptions],
  ) as Record<ProviderKind, ReadonlyArray<ProviderModelOption & { isCustom?: boolean }>>;

  const runtimeModelsByProvider = useMemo(
    () => ({
      opencode: dynamicModels,
    }),
    [dynamicModels],
  ) as Record<ProviderKind, ReadonlyArray<ProviderModelDescriptor>>;

  const selectedRuntimeModel = useMemo(
    () =>
      resolveRuntimeModelDescriptor({
        provider: OPENCODE_PROVIDER,
        model: modelHintByProvider?.opencode,
        runtimeModels: runtimeModelsByProvider.opencode,
      }),
    [modelHintByProvider?.opencode, runtimeModelsByProvider.opencode],
  );

  const selectedRuntimeAgents = openCodeDynamicAgentsQuery.data?.agents ?? EMPTY_PROVIDER_AGENTS;

  return {
    modelOptionsByProvider,
    loadingModelProviders: {
      opencode: openCodeDynamicModelsQuery.isPending && dynamicModels.length === 0,
    },
    runtimeModelsByProvider,
    selectedRuntimeModel,
    selectedRuntimeAgents,
  };
}