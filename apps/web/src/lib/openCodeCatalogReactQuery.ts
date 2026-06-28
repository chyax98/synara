import type { QueryClient } from "@tanstack/react-query";
import type {
  OpenCodeCatalogInput,
  OpenCodeOauthAuthorizeInput,
  OpenCodeOauthCallbackInput,
  OpenCodeAuthRemoveInput,
  OpenCodeAuthSetInput,
} from "@t3tools/contracts";
import { queryOptions } from "@tanstack/react-query";
import { buildOpenCodeCatalogRequest } from "~/lib/openCodeCatalogConnection";
import { ensureNativeApi } from "~/nativeApi";
import { providerDiscoveryQueryKeys } from "~/lib/providerDiscoveryReactQuery";

export const openCodeCatalogQueryKeys = {
  all: ["opencode-catalog"] as const,
  overview: (binaryPath: string | null, serverUrl: string | null, cwd: string | null) =>
    [...openCodeCatalogQueryKeys.all, "overview", binaryPath, serverUrl, cwd] as const,
  configProviders: (binaryPath: string | null, cwd: string | null) =>
    [...openCodeCatalogQueryKeys.all, "config-providers", binaryPath, cwd] as const,
  providerAvailable: (binaryPath: string | null, cwd: string | null) =>
    [...openCodeCatalogQueryKeys.all, "provider-available", binaryPath, cwd] as const,
  providerAuth: (binaryPath: string | null, cwd: string | null) =>
    [...openCodeCatalogQueryKeys.all, "provider-auth", binaryPath, cwd] as const,
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
    queryKey: openCodeCatalogQueryKeys.overview(input.binaryPath, serverUrl, cwd),
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

export async function mutateOpenCodeOauthAuthorize(input: OpenCodeOauthAuthorizeInput) {
  const api = await ensureNativeApi();
  return api.opencode.oauthAuthorize(input);
}

export async function mutateOpenCodeOauthCallback(input: OpenCodeOauthCallbackInput) {
  const api = await ensureNativeApi();
  return api.opencode.oauthCallback(input);
}
