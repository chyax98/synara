// FILE: useOpenCodeModelCatalog.ts
// Purpose: Shared OpenCode catalog state via SDK catalog overview (authoritative pipeline).
// Layer: Web hooks

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { useAppSettings } from "~/appSettings";
import { readOpenCodeCatalogConnection } from "~/lib/openCodeCatalogConnection";
import {
  buildOpenCodeModelCatalogOptions,
  flattenModelsFromCatalogOverview,
} from "~/lib/openCodeModelCatalog";
import {
  buildModelCatalogSidebar,
  groupModelOptionsByUpstreamProvider,
  type ModelCatalogProviderGroup,
} from "~/lib/modelCatalogSettings";
import {
  configuredProviderIdsFromConfigProviders,
  mergeCatalogAvailabilityWithConfigProviders,
  modelOptionsFromConfigProviders,
  splitConfiguredSidebarGroups,
} from "~/lib/mergeConfigProvidersIntoCatalog";
import {
  invalidateOpenCodeDiscovery,
  openCodeCatalogOverviewQueryOptions,
  openCodeConfigProvidersQueryOptions,
} from "~/lib/openCodeCatalogReactQuery";

export function useOpenCodeModelCatalog(input?: {
  /** null = server cwd (settings); project path scopes per-project catalog in chat. */
  cwd?: string | null;
  enabled?: boolean;
  modelHint?: string | null;
}) {
  const enabled = input?.enabled ?? true;
  const cwd = input?.cwd ?? null;
  const modelHint = input?.modelHint ?? null;
  const queryClient = useQueryClient();
  const { settings, updateSettings } = useAppSettings();
  const connection = readOpenCodeCatalogConnection(settings);

  const overviewQuery = useQuery(
    openCodeCatalogOverviewQueryOptions({
      binaryPath: connection.binaryPath,
      serverUrl: connection.serverUrl,
      serverPassword: connection.serverPassword,
      cwd,
      enabled,
    }),
  );

  const configProvidersQuery = useQuery(
    openCodeConfigProvidersQueryOptions({
      binaryPath: connection.binaryPath,
      serverUrl: connection.serverUrl,
      serverPassword: connection.serverPassword,
      cwd,
      enabled,
    }),
  );

  const configProviders = configProvidersQuery.data?.providers ?? [];

  const discoverableAvailability = useMemo(
    () =>
      overviewQuery.data?.availability.all.map((provider) => ({
        id: provider.id,
        name: provider.name,
      })) ?? [],
    [overviewQuery.data?.availability.all],
  );

  const discoverableAvailabilityIds = useMemo(
    () => new Set(discoverableAvailability.map((provider) => provider.id)),
    [discoverableAvailability],
  );

  const mergedAvailability = useMemo(
    () => mergeCatalogAvailabilityWithConfigProviders(discoverableAvailability, configProviders),
    [configProviders, discoverableAvailability],
  );

  const configuredProviderIds = useMemo(
    () => configuredProviderIdsFromConfigProviders(configProviders),
    [configProviders],
  );

  const configModelOptions = useMemo(
    () => modelOptionsFromConfigProviders(configProviders),
    [configProviders],
  );

  const dynamicModels = useMemo(() => {
    const fromOverview = overviewQuery.data
      ? flattenModelsFromCatalogOverview(overviewQuery.data)
      : [];
    const seen = new Set(fromOverview.map((model) => model.slug));
    const fromConfig = configModelOptions
      .filter((option) => !seen.has(option.slug))
      .map((option) => ({
        slug: option.slug,
        name: option.name,
        upstreamProviderId: option.upstreamProviderId,
        upstreamProviderName: option.upstreamProviderName,
      }));
    return [...fromOverview, ...fromConfig];
  }, [configModelOptions, overviewQuery.data]);

  const catalogAgents = useMemo(
    () => overviewQuery.data?.agents ?? [],
    [overviewQuery.data?.agents],
  );

  const { catalogOptions, visibleOptions } = useMemo(
    () =>
      buildOpenCodeModelCatalogOptions({
        customOpenCodeModels: settings.customOpenCodeModels,
        dynamicModels,
        hiddenModels: settings.hiddenModels,
        modelHint,
      }),
    [dynamicModels, modelHint, settings.customOpenCodeModels, settings.hiddenModels],
  );

  const modelGroups = useMemo(
    () => groupModelOptionsByUpstreamProvider(catalogOptions),
    [catalogOptions],
  );

  const connectedProviderIds = useMemo(
    () => new Set(overviewQuery.data?.availability.connected ?? []),
    [overviewQuery.data?.availability.connected],
  );

  const catalogSidebar = useMemo(() => {
    if (mergedAvailability.length === 0 && modelGroups.length > 0) {
      return buildModelCatalogSidebar({
        availability: modelGroups.map((group) => ({ id: group.id, name: group.name })),
        connectedIds: connectedProviderIds,
        modelGroups,
      });
    }
    return buildModelCatalogSidebar({
      availability: mergedAvailability,
      connectedIds: connectedProviderIds,
      modelGroups,
    });
  }, [connectedProviderIds, mergedAvailability, modelGroups]);

  const { configuredOnlyProviders, discoverableUnconnectedProviders } = useMemo(
    () =>
      splitConfiguredSidebarGroups({
        unconnectedProviders: catalogSidebar.unconnectedProviders,
        discoverableAvailabilityIds,
        configuredProviderIds,
      }),
    [catalogSidebar.unconnectedProviders, configuredProviderIds, discoverableAvailabilityIds],
  );

  const refreshCatalog = useCallback(async () => {
    await invalidateOpenCodeDiscovery(queryClient);
  }, [queryClient]);

  const isLoading = enabled && overviewQuery.isPending && catalogOptions.length === 0;

  const isError = overviewQuery.isError && catalogOptions.length === 0;

  const errorMessage = overviewQuery.error instanceof Error ? overviewQuery.error.message : null;

  const resolveGroup = useCallback(
    (providerId: string | null): ModelCatalogProviderGroup | null => {
      if (!providerId) {
        return null;
      }
      return (
        catalogSidebar.sidebarGroups.find((group) => group.id === providerId) ??
        configuredOnlyProviders.find((group) => group.id === providerId) ??
        discoverableUnconnectedProviders.find((group) => group.id === providerId) ??
        null
      );
    },
    [catalogSidebar.sidebarGroups, configuredOnlyProviders, discoverableUnconnectedProviders],
  );

  return {
    connection,
    settings,
    updateSettings,
    overviewQuery,
    dynamicModels,
    catalogAgents,
    catalogOptions,
    visibleOptions,
    modelGroups,
    connectedProviderIds,
    sidebarGroups: catalogSidebar.sidebarGroups,
    unconnectedProviders: catalogSidebar.unconnectedProviders,
    configuredOnlyProviders,
    discoverableUnconnectedProviders,
    configuredProviderIds,
    authMethodsByProvider: overviewQuery.data?.authMethods ?? {},
    isLoading,
    isError,
    errorMessage,
    isDiscoveryPending: enabled && overviewQuery.isFetching && catalogOptions.length === 0,
    refreshCatalog,
    resolveGroup,
  };
}
