// FILE: openCodeCatalogConnection.ts
// Purpose: Build OpenCode catalog RPC inputs from AppSettings connection fields.
// Layer: Web catalog helpers

import type { OpenCodeCatalogInput, OpenCodeConnectionInput } from "@t3tools/contracts";

import type { AppSettings } from "~/appSettings";

export type OpenCodeCatalogConnection = {
  binaryPath: string | null;
  serverUrl: string | null;
  serverPassword: string | null;
  resolvedBinaryLabel: string;
};

/** Stable React Query key segment for full connection (includes password for cache correctness). */
export function openCodeConnectionQueryKey(
  connection: Pick<OpenCodeCatalogConnection, "binaryPath" | "serverUrl" | "serverPassword">,
): readonly [string | null, string | null, string | null] {
  return [connection.binaryPath, connection.serverUrl, connection.serverPassword];
}

export function readOpenCodeCatalogConnection(
  settings: Pick<
    AppSettings,
    "openCodeBinaryPath" | "openCodeServerUrl" | "openCodeServerPassword"
  >,
): OpenCodeCatalogConnection {
  const binaryPath = settings.openCodeBinaryPath.trim() || null;
  const serverUrl = settings.openCodeServerUrl.trim() || null;
  const serverPassword = settings.openCodeServerPassword.trim() || null;
  return {
    binaryPath,
    serverUrl,
    serverPassword,
    resolvedBinaryLabel: binaryPath ?? "opencode（系统 PATH）",
  };
}

export function buildOpenCodeCatalogRequest(input: {
  binaryPath: string | null;
  serverUrl: string | null;
  serverPassword: string | null;
  cwd?: string | null;
}): OpenCodeCatalogInput {
  return buildOpenCodeConnectionRequest(input);
}

export function buildOpenCodeConnectionRequest(input: {
  binaryPath: string | null;
  serverUrl: string | null;
  serverPassword: string | null;
  cwd?: string | null;
}): OpenCodeConnectionInput {
  return {
    ...(input.binaryPath ? { binaryPath: input.binaryPath } : {}),
    ...(input.cwd ? { cwd: input.cwd } : {}),
    ...(input.serverUrl ? { serverUrl: input.serverUrl } : {}),
    ...(input.serverPassword ? { serverPassword: input.serverPassword } : {}),
  };
}

/**
 * Settings use server cwd (null); chat surfaces pass project discovery cwd.
 * Different cwd values intentionally produce separate catalog caches.
 */
export const OPENCODE_CATALOG_SETTINGS_CWD: null = null;
