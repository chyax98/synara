// FILE: openCodeCatalogReload.ts
// Purpose: Gate catalog refresh after mutations on openCodeAutoReloadCatalog (shipped knob).
// Layer: Web OpenCode catalog helpers

import type { QueryClient } from "@tanstack/react-query";

import { reloadOpenCodeCatalogAfterMutation } from "~/lib/openCodeCatalogReactQuery";

export async function maybeReloadOpenCodeCatalogAfterMutation(
  queryClient: QueryClient,
  autoReload: boolean,
): Promise<void> {
  if (!autoReload) {
    return;
  }
  await reloadOpenCodeCatalogAfterMutation(queryClient);
}

export async function maybeRefreshOpenCodeCatalog(
  autoReload: boolean,
  refresh: () => Promise<void>,
): Promise<void> {
  if (!autoReload) {
    return;
  }
  await refresh();
}
