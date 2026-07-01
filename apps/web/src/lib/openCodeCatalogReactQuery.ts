import type { QueryClient } from "@tanstack/react-query";
import type {
  OpenCodeAddProviderModelInput,
  OpenCodeCatalogInput,
  OpenCodeConfigUpdateInput,
  OpenCodeOauthAuthorizeInput,
  OpenCodeOauthCallbackInput,
  OpenCodeAuthRemoveInput,
  OpenCodeAuthSetInput,
  OpenCodeProviderConfigSourcesInput,
  OpenCodeProviderDisconnectInput,
  OpenCodeRemoveProviderModelInput,
  OpenCodeUpsertCustomProviderInput,
} from "@t3tools/contracts";
import { queryOptions } from "@tanstack/react-query";
import {
  buildOpenCodeCatalogRequest,
  openCodeConnectionQueryKey,
} from "~/lib/openCodeCatalogConnection";
import { ensureNativeApi } from "~/nativeApi";
import { providerDiscoveryQueryKeys } from "~/lib/providerDiscoveryReactQuery";

export const openCodeCatalogQueryKeys = {
  all: ["opencode-catalog"] as const,
  overview: (
    binaryPath: string | null,
    serverUrl: string | null,
    serverPassword: string | null,
    cwd: string | null,
  ) =>
    [
      ...openCodeCatalogQueryKeys.all,
      "overview",
      binaryPath,
      serverUrl,
      serverPassword,
      cwd,
    ] as const,
  configProviders: (binaryPath: string | null, cwd: string | null) =>
    [...openCodeCatalogQueryKeys.all, "config-providers", binaryPath, cwd] as const,
  providerAvailable: (binaryPath: string | null, cwd: string | null) =>
    [...openCodeCatalogQueryKeys.all, "provider-available", binaryPath, cwd] as const,
  providerAuth: (binaryPath: string | null, cwd: string | null) =>
    [...openCodeCatalogQueryKeys.all, "provider-auth", binaryPath, cwd] as const,
  providerConfigSources: (
    binaryPath: string | null,
    serverUrl: string | null,
    serverPassword: string | null,
    cwd: string | null,
    providerID: string,
  ) =>
    [
      ...openCodeCatalogQueryKeys.all,
      "provider-config-sources",
      binaryPath,
      serverUrl,
      serverPassword,
      cwd,
      providerID,
    ] as const,
};

export function openCodeCatalogOverviewQueryOptions(input: {
  binaryPath: string | null;
  serverUrl?: string | null;
  serverPassword?: string | null;
  cwd?: string | null;
  enabled?: boolean;
}) {
  const cwd = input.cwd ?? null;
  const serverUrl = input.serverUrl ?? null;
  const serverPassword = input.serverPassword ?? null;
  const request = buildOpenCodeCatalogRequest({
    binaryPath: input.binaryPath,
    serverUrl,
    serverPassword,
    cwd,
  });
  return queryOptions({
    queryKey: openCodeCatalogQueryKeys.overview(input.binaryPath, serverUrl, serverPassword, cwd),
    enabled: input.enabled ?? true,
    staleTime: 30_000,
    retry: 1,
    queryFn: async () => {
      const api = await ensureNativeApi();
      return api.opencode.catalogOverview(request);
    },
  });
}

export function invalidateOpenCodeDiscovery(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: openCodeCatalogQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: providerDiscoveryQueryKeys.all }),
  ]);
}

export async function mutateOpenCodeAuthSet(input: OpenCodeAuthSetInput) {
  const api = await ensureNativeApi();
  return api.opencode.authSet(input);
}

export async function mutateOpenCodeAuthRemove(input: OpenCodeAuthRemoveInput) {
  const api = await ensureNativeApi();
  return api.opencode.authRemove(input);
}

export async function mutateOpenCodeProviderDisconnect(input: OpenCodeProviderDisconnectInput) {
  const api = await ensureNativeApi();
  return api.opencode.providerDisconnect(input);
}

export async function mutateOpenCodeConfigUpdate(input: OpenCodeConfigUpdateInput) {
  const api = await ensureNativeApi();
  return api.opencode.configUpdate(input);
}

export async function mutateOpenCodeAddProviderModel(input: OpenCodeAddProviderModelInput) {
  const api = await ensureNativeApi();
  return api.opencode.addProviderModel(input);
}

export async function mutateOpenCodeUpsertCustomProvider(input: OpenCodeUpsertCustomProviderInput) {
  const api = await ensureNativeApi();
  return api.opencode.upsertCustomProvider(input);
}

export async function mutateOpenCodeRemoveProviderModel(input: OpenCodeRemoveProviderModelInput) {
  const api = await ensureNativeApi();
  return api.opencode.removeProviderModel(input);
}

/** Always refresh catalog after config/auth mutations (OpenChamber reloadOpenCodeConfiguration). */
export async function reloadOpenCodeCatalogAfterMutation(queryClient: QueryClient): Promise<void> {
  await invalidateOpenCodeDiscovery(queryClient);
}

export function openCodeConfigProvidersQueryOptions(input: {
  binaryPath: string | null;
  serverUrl?: string | null;
  serverPassword?: string | null;
  cwd?: string | null;
  enabled?: boolean;
}) {
  const cwd = input.cwd ?? null;
  const serverUrl = input.serverUrl ?? null;
  const serverPassword = input.serverPassword ?? null;
  const request = buildOpenCodeCatalogRequest({
    binaryPath: input.binaryPath,
    serverUrl,
    serverPassword,
    cwd,
  });
  return queryOptions({
    queryKey: openCodeCatalogQueryKeys.configProviders(input.binaryPath, cwd),
    enabled: input.enabled ?? true,
    staleTime: 30_000,
    retry: 1,
    queryFn: async () => {
      const api = await ensureNativeApi();
      return api.opencode.configProviders(request);
    },
  });
}

export async function mutateOpenCodeOauthAuthorize(input: OpenCodeOauthAuthorizeInput) {
  const api = await ensureNativeApi();
  return api.opencode.oauthAuthorize(input);
}

export async function mutateOpenCodeOauthCallback(input: OpenCodeOauthCallbackInput) {
  const api = await ensureNativeApi();
  return api.opencode.oauthCallback(input);
}

export function openCodeProviderConfigSourcesQueryOptions(input: {
  binaryPath: string | null;
  serverUrl?: string | null;
  serverPassword?: string | null;
  cwd?: string | null;
  providerID: string;
  enabled?: boolean;
}) {
  const cwd = input.cwd ?? null;
  const serverUrl = input.serverUrl ?? null;
  const serverPassword = input.serverPassword ?? null;
  const request: OpenCodeProviderConfigSourcesInput = {
    ...buildOpenCodeCatalogRequest({
      binaryPath: input.binaryPath,
      serverUrl,
      serverPassword,
      cwd,
    }),
    providerID: input.providerID,
  };
  return queryOptions({
    queryKey: openCodeCatalogQueryKeys.providerConfigSources(
      input.binaryPath,
      serverUrl,
      serverPassword,
      cwd,
      input.providerID,
    ),
    enabled: (input.enabled ?? true) && input.providerID.trim().length > 0,
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      const api = await ensureNativeApi();
      return api.opencode.providerConfigSources(request);
    },
  });
}
