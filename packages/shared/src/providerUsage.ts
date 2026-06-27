// FILE: providerUsage.ts
// Purpose: Provider-usage presentation metadata for OpenCode-native Synara.
// OpenCode has no fetchable usage endpoint, so this module exposes empty helpers.

import type { ProviderKind } from "@t3tools/contracts";

interface ProviderUsageMeta {
  displayName: string;
  signInCommand: string;
  learnMoreHref: string | null;
}

const PROVIDER_USAGE_META: Partial<Record<ProviderKind, ProviderUsageMeta>> = {};

export const PROVIDER_USAGE_PROVIDERS: ReadonlyArray<ProviderKind> = [];

function lookupMeta(provider: string | null | undefined): ProviderUsageMeta | undefined {
  if (!provider) {
    return undefined;
  }
  return PROVIDER_USAGE_META[provider as ProviderKind];
}

export function isProviderUsageSupported(provider: string | null | undefined): boolean {
  return lookupMeta(provider) !== undefined;
}

export function providerUsageLabel(provider: string | null | undefined): string {
  const meta = lookupMeta(provider);
  return meta ? `${meta.displayName} usage` : "Usage";
}

export function providerUsageDisplayName(provider: string | null | undefined): string {
  return lookupMeta(provider)?.displayName ?? "Provider";
}

export function providerUsageLearnMoreHref(provider: string | null | undefined): string | null {
  return lookupMeta(provider)?.learnMoreHref ?? null;
}

export function providerUsageNeedsAuthDetail(provider: string | null | undefined): string {
  const meta = lookupMeta(provider);
  if (!meta) {
    return "Sign in with the provider CLI to see usage.";
  }
  return `Sign in with \`${meta.signInCommand}\` to see usage.`;
}