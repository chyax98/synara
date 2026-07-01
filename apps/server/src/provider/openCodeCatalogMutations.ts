// FILE: openCodeCatalogMutations.ts
// Purpose: Pure OpenCode config mutation helpers (testable, OpenChamber/OpenCode-aligned).
// Layer: Server provider utilities

import type {
  OpenCodeProviderConfigSources,
  OpenCodeProviderDisconnectScope,
} from "@t3tools/contracts";

const OPENAI_COMPATIBLE_NPM = "@ai-sdk/openai-compatible";

export type CustomProviderModelRow = {
  readonly id: string;
  readonly name: string;
};

export function buildAddProviderModelConfigPatch(input: {
  readonly providerID: string;
  readonly modelID: string;
  readonly displayName: string;
}): Record<string, unknown> {
  return {
    provider: {
      [input.providerID]: {
        models: {
          [input.modelID]: { name: input.displayName },
        },
      },
    },
  };
}

export function buildCustomProviderConfigPatch(input: {
  readonly providerID: string;
  readonly name: string;
  readonly baseURL: string;
  readonly models: ReadonlyArray<CustomProviderModelRow>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly env?: ReadonlyArray<string>;
}): Record<string, unknown> {
  const modelConfig = Object.fromEntries(
    input.models.map((row) => [row.id.trim(), { name: row.name.trim() }]),
  );
  return {
    provider: {
      [input.providerID]: {
        npm: OPENAI_COMPATIBLE_NPM,
        name: input.name.trim(),
        ...(input.env && input.env.length > 0 ? { env: [...input.env] } : {}),
        options: {
          baseURL: input.baseURL.trim(),
          ...(input.headers && Object.keys(input.headers).length > 0
            ? { headers: { ...input.headers } }
            : {}),
        },
        models: modelConfig,
      },
    },
  };
}

export function buildRemoveProviderModelConfigPatch(input: {
  readonly providerID: string;
  readonly modelID: string;
  readonly existingProviderConfig: Record<string, unknown>;
}): Record<string, unknown> | null {
  const models = input.existingProviderConfig.models;
  if (!models || typeof models !== "object" || Array.isArray(models)) {
    return null;
  }
  const modelsRecord = models as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(modelsRecord, input.modelID)) {
    return null;
  }
  const nextModels = { ...modelsRecord };
  delete nextModels[input.modelID];
  return {
    provider: {
      [input.providerID]: {
        ...input.existingProviderConfig,
        models: nextModels,
      },
    },
  };
}

export function parseProviderModelSlug(
  slug: string,
): { providerID: string; modelID: string } | null {
  const trimmed = slug.trim();
  const slashIndex = trimmed.indexOf("/");
  if (slashIndex <= 0 || slashIndex >= trimmed.length - 1) {
    return null;
  }
  const providerID = trimmed.slice(0, slashIndex).trim();
  const modelID = trimmed.slice(slashIndex + 1).trim();
  if (!providerID || !modelID) {
    return null;
  }
  return { providerID, modelID };
}

export function resolveDisconnectScopeOptions(
  sources: OpenCodeProviderConfigSources,
): ReadonlyArray<{ value: OpenCodeProviderDisconnectScope; label: string }> {
  const options: Array<{ value: OpenCodeProviderDisconnectScope; label: string }> = [
    { value: "all", label: "全部层（认证 + 配置）" },
  ];
  if (sources.auth.exists) {
    options.push({ value: "auth", label: "仅认证凭据" });
  }
  if (sources.user.exists) {
    options.push({ value: "user", label: "用户配置 (~/.config/opencode)" });
  }
  if (sources.project.exists) {
    options.push({ value: "project", label: "项目 opencode.json" });
  }
  if (sources.custom.exists) {
    options.push({ value: "custom", label: "OPENCODE_CONFIG 自定义层" });
  }
  return options;
}
