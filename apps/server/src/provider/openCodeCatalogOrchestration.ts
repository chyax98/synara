// FILE: openCodeCatalogOrchestration.ts
// Purpose: Testable orchestration for OpenCode catalog config/auth mutations (shipped entry points).
// Layer: Server provider utilities

import type {
  OpenCodeProviderConfigSources,
  OpenCodeProviderDisconnectScope,
} from "@t3tools/contracts";

import {
  buildAddProviderModelConfigPatch,
  buildCustomProviderConfigPatch,
  buildRemoveProviderModelConfigPatch,
  parseProviderModelSlug,
  type CustomProviderModelRow,
} from "./openCodeCatalogMutations.ts";
import type { OpenCodeConfigScope } from "./openCodeConfigLayers.ts";

export class OpenCodeCatalogOrchestrationError extends Error {
  readonly operation: string;
  readonly detail: string;

  constructor(operation: string, detail: string) {
    super(`${operation}: ${detail}`);
    this.operation = operation;
    this.detail = detail;
  }
}

export type OpenCodeCatalogOrchestrationPorts = {
  readonly cwd: string;
  readonly configGet: () => Promise<{ config: Record<string, unknown> }>;
  readonly configUpdate: (config: Record<string, unknown>) => Promise<{ ok: true }>;
  readonly authSet: (providerID: string, apiKey: string) => Promise<{ ok: true }>;
  readonly authRemove: (providerID: string) => Promise<{ ok: true }>;
  readonly getSources: (providerID: string) => OpenCodeProviderConfigSources;
  readonly removeProviderConfigLayer: (input: {
    providerId: string;
    scope: OpenCodeConfigScope;
  }) => boolean;
  readonly removeProviderModelLayer: (input: {
    providerId: string;
    modelId: string;
    scope: OpenCodeConfigScope;
  }) => boolean;
};

export async function orchestrateProviderDisconnect(input: {
  readonly providerID: string;
  readonly scope: OpenCodeProviderDisconnectScope;
  readonly ports: OpenCodeCatalogOrchestrationPorts;
}): Promise<{ ok: true; removed: boolean }> {
  let removed = false;
  const sources = input.ports.getSources(input.providerID);

  if (input.scope === "auth" || input.scope === "all") {
    if (sources.auth.exists || input.scope === "auth") {
      await input.ports.authRemove(input.providerID);
      removed = sources.auth.exists || input.scope === "auth";
    }
  }

  if (
    input.scope === "user" ||
    input.scope === "project" ||
    input.scope === "custom" ||
    input.scope === "all"
  ) {
    const scopes: ReadonlyArray<OpenCodeConfigScope> =
      input.scope === "all" ? ["user", "project", "custom"] : [input.scope];
    for (const layerScope of scopes) {
      if (layerScope === "project" && input.ports.cwd.length === 0) {
        continue;
      }
      if (
        input.ports.removeProviderConfigLayer({
          providerId: input.providerID,
          scope: layerScope,
        })
      ) {
        removed = true;
      }
    }
  }

  return { ok: true, removed };
}

export async function orchestrateAddProviderModel(input: {
  readonly slug: string;
  readonly displayName?: string | undefined;
  readonly ports: OpenCodeCatalogOrchestrationPorts;
}): Promise<{ ok: true }> {
  const parsed = parseProviderModelSlug(input.slug);
  if (!parsed) {
    throw new OpenCodeCatalogOrchestrationError(
      "addProviderModel",
      "Model slug must use providerID/modelID format.",
    );
  }
  const displayName = input.displayName?.trim() || parsed.modelID;
  await input.ports.configUpdate(
    buildAddProviderModelConfigPatch({
      providerID: parsed.providerID,
      modelID: parsed.modelID,
      displayName,
    }),
  );
  return { ok: true };
}

export async function orchestrateUpsertCustomProvider(input: {
  readonly providerID: string;
  readonly name: string;
  readonly baseURL: string;
  readonly apiKey?: string | undefined;
  readonly models: ReadonlyArray<CustomProviderModelRow>;
  readonly headers?: Readonly<Record<string, string>> | undefined;
  readonly ports: OpenCodeCatalogOrchestrationPorts;
}): Promise<{ ok: true }> {
  const apiKey = input.apiKey?.trim();
  if (apiKey) {
    await input.ports.authSet(input.providerID, apiKey);
  }
  await input.ports.configUpdate(
    buildCustomProviderConfigPatch({
      providerID: input.providerID,
      name: input.name,
      baseURL: input.baseURL,
      models: input.models,
      ...(input.headers ? { headers: input.headers } : {}),
    }),
  );
  return { ok: true };
}

export async function orchestrateRemoveProviderModel(input: {
  readonly slug: string;
  readonly scope?: OpenCodeProviderDisconnectScope | undefined;
  readonly ports: OpenCodeCatalogOrchestrationPorts;
}): Promise<{ ok: true }> {
  const parsed = parseProviderModelSlug(input.slug);
  if (!parsed) {
    throw new OpenCodeCatalogOrchestrationError(
      "removeProviderModel",
      "Model slug must use providerID/modelID format.",
    );
  }

  const current = await input.ports.configGet();
  const providerRoot = current.config.provider;
  const providerConfig =
    providerRoot &&
    typeof providerRoot === "object" &&
    !Array.isArray(providerRoot) &&
    typeof (providerRoot as Record<string, unknown>)[parsed.providerID] === "object"
      ? ((providerRoot as Record<string, unknown>)[parsed.providerID] as Record<string, unknown>)
      : null;

  if (providerConfig) {
    const patch = buildRemoveProviderModelConfigPatch({
      providerID: parsed.providerID,
      modelID: parsed.modelID,
      existingProviderConfig: providerConfig,
    });
    if (patch) {
      await input.ports.configUpdate(patch);
      return { ok: true };
    }
  }

  const scope = input.scope ?? "all";
  const scopes: ReadonlyArray<OpenCodeConfigScope> =
    scope === "all" ? ["user", "project", "custom"] : scope === "auth" ? [] : [scope];
  let removed = false;
  for (const layerScope of scopes) {
    if (layerScope === "project" && input.ports.cwd.length === 0) {
      continue;
    }
    if (
      input.ports.removeProviderModelLayer({
        providerId: parsed.providerID,
        modelId: parsed.modelID,
        scope: layerScope,
      })
    ) {
      removed = true;
    }
  }

  if (!removed) {
    throw new OpenCodeCatalogOrchestrationError(
      "removeProviderModel",
      `Model ${input.slug} was not found in OpenCode config layers.`,
    );
  }

  return { ok: true };
}
