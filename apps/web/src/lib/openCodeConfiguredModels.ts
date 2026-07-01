// FILE: openCodeConfiguredModels.ts
// Purpose: Derive user-written model slugs from OpenCode config.providers catalog.
// Layer: Web OpenCode catalog helpers

import type { OpenCodeCatalogProvider } from "@t3tools/contracts";

export function listConfiguredModelSlugs(
  providers: ReadonlyArray<OpenCodeCatalogProvider>,
): string[] {
  const slugs: string[] = [];
  const seen = new Set<string>();

  for (const provider of providers) {
    if (provider.source !== "config" && provider.source !== "custom") {
      continue;
    }
    const models = provider.models;
    if (!models || typeof models !== "object") {
      continue;
    }
    for (const modelId of Object.keys(models)) {
      const slug = `${provider.id}/${modelId}`;
      if (seen.has(slug)) {
        continue;
      }
      seen.add(slug);
      slugs.push(slug);
    }
  }

  return slugs.sort((left, right) => left.localeCompare(right));
}
