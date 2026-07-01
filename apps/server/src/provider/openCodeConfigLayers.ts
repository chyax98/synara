// FILE: openCodeConfigLayers.ts
// Purpose: Read OpenCode config file layers for provider provenance (OpenChamber-style).
// Layer: Server provider utilities

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { parseOpenCodeConfigDocument } from "./openCodeConfigParse.ts";

export type OpenCodeConfigSourceLayer = {
  readonly exists: boolean;
  readonly path: string | null;
};

export type OpenCodeProviderConfigSources = {
  readonly auth: OpenCodeConfigSourceLayer;
  readonly user: OpenCodeConfigSourceLayer;
  readonly project: OpenCodeConfigSourceLayer;
  readonly custom: OpenCodeConfigSourceLayer;
};

const OPENCODE_CONFIG_DIR = join(homedir(), ".config", "opencode");

function openCodeDataDir(): string {
  const xdgData = process.env.XDG_DATA_HOME?.trim();
  const base = xdgData && xdgData.length > 0 ? xdgData : join(homedir(), ".local", "share");
  return join(base, "opencode");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function providerConfiguredInConfig(config: Record<string, unknown>, providerId: string): boolean {
  const provider = isPlainObject(config.provider) ? config.provider : {};
  const providers = isPlainObject(config.providers) ? config.providers : {};
  return (
    Object.prototype.hasOwnProperty.call(provider, providerId) ||
    Object.prototype.hasOwnProperty.call(providers, providerId)
  );
}

function readConfigIfExists(filePath: string): Record<string, unknown> | null {
  if (!existsSync(filePath)) {
    return null;
  }
  return parseOpenCodeConfigDocument(readFileSync(filePath, "utf8"));
}

function firstExistingPath(paths: ReadonlyArray<string>): string | null {
  for (const candidate of paths) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return paths[0] ?? null;
}

function projectConfigCandidates(workingDirectory: string): string[] {
  return [
    join(workingDirectory, "opencode.json"),
    join(workingDirectory, "opencode.jsonc"),
    join(workingDirectory, ".opencode", "opencode.json"),
    join(workingDirectory, ".opencode", "opencode.jsonc"),
  ];
}

function userConfigCandidates(): string[] {
  return [
    join(OPENCODE_CONFIG_DIR, "config.json"),
    join(OPENCODE_CONFIG_DIR, "opencode.json"),
    join(OPENCODE_CONFIG_DIR, "opencode.jsonc"),
  ];
}

export type OpenCodeConfigScope = "user" | "project" | "custom";

function isEmptyConfigObject(config: Record<string, unknown>): boolean {
  return Object.keys(config).length === 0;
}

function writeConfigJson(filePath: string, config: Record<string, unknown>): void {
  const parentDir = dirname(filePath);
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }
  writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function writeOrUnlinkConfigJson(filePath: string, config: Record<string, unknown>): void {
  if (isEmptyConfigObject(config)) {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    return;
  }
  writeConfigJson(filePath, config);
}

function readConfigForPath(filePath: string | null): Record<string, unknown> {
  if (!filePath) {
    return {};
  }
  return readConfigIfExists(filePath) ?? {};
}

function resolveConfigPathForScope(input: {
  readonly cwd: string;
  readonly scope: OpenCodeConfigScope;
}): string | null {
  if (input.scope === "custom") {
    const customPath = process.env.OPENCODE_CONFIG?.trim();
    return customPath ? resolve(customPath) : null;
  }
  if (input.scope === "project") {
    if (input.cwd.length === 0) {
      return null;
    }
    return (
      firstExistingPath(projectConfigCandidates(input.cwd)) ?? join(input.cwd, "opencode.json")
    );
  }
  return firstExistingPath(userConfigCandidates()) ?? join(OPENCODE_CONFIG_DIR, "opencode.json");
}

export function removeOpenCodeProviderConfig(input: {
  readonly providerId: string;
  readonly cwd: string;
  readonly scope: OpenCodeConfigScope;
}): boolean {
  const providerId = input.providerId.trim();
  if (!providerId) {
    return false;
  }

  const targetPath = resolveConfigPathForScope({ cwd: input.cwd, scope: input.scope });
  if (!targetPath) {
    return false;
  }

  const targetConfig = readConfigForPath(targetPath);
  const providerConfig = isPlainObject(targetConfig.provider) ? targetConfig.provider : {};
  const providersConfig = isPlainObject(targetConfig.providers) ? targetConfig.providers : {};

  const removedProvider = Object.prototype.hasOwnProperty.call(providerConfig, providerId);
  const removedProviders = Object.prototype.hasOwnProperty.call(providersConfig, providerId);

  if (!removedProvider && !removedProviders) {
    return false;
  }

  if (removedProvider) {
    delete providerConfig[providerId];
    if (Object.keys(providerConfig).length === 0) {
      delete targetConfig.provider;
    } else {
      targetConfig.provider = providerConfig;
    }
  }

  if (removedProviders) {
    delete providersConfig[providerId];
    if (Object.keys(providersConfig).length === 0) {
      delete targetConfig.providers;
    } else {
      targetConfig.providers = providersConfig;
    }
  }

  writeOrUnlinkConfigJson(targetPath, targetConfig);
  return true;
}

export function removeOpenCodeProviderModel(input: {
  readonly providerId: string;
  readonly modelId: string;
  readonly cwd: string;
  readonly scope: OpenCodeConfigScope;
}): boolean {
  const providerId = input.providerId.trim();
  const modelId = input.modelId.trim();
  if (!providerId || !modelId) {
    return false;
  }

  const targetPath = resolveConfigPathForScope({ cwd: input.cwd, scope: input.scope });
  if (!targetPath) {
    return false;
  }

  const targetConfig = readConfigForPath(targetPath);
  const providerRoot = isPlainObject(targetConfig.provider) ? targetConfig.provider : {};
  const providersRoot = isPlainObject(targetConfig.providers) ? targetConfig.providers : {};

  let changed = false;

  if (Object.prototype.hasOwnProperty.call(providerRoot, providerId)) {
    const providerEntry = providerRoot[providerId];
    if (isPlainObject(providerEntry) && isPlainObject(providerEntry.models)) {
      if (Object.prototype.hasOwnProperty.call(providerEntry.models, modelId)) {
        delete providerEntry.models[modelId];
        changed = true;
        if (Object.keys(providerEntry.models).length === 0) {
          delete providerEntry.models;
        }
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(providersRoot, providerId)) {
    const providerEntry = providersRoot[providerId];
    if (isPlainObject(providerEntry) && isPlainObject(providerEntry.models)) {
      if (Object.prototype.hasOwnProperty.call(providerEntry.models, modelId)) {
        delete providerEntry.models[modelId];
        changed = true;
        if (Object.keys(providerEntry.models).length === 0) {
          delete providerEntry.models;
        }
      }
    }
  }

  if (!changed) {
    return false;
  }

  writeOrUnlinkConfigJson(targetPath, targetConfig);
  return true;
}

export function getOpenCodeProviderConfigSources(input: {
  readonly providerId: string;
  readonly cwd: string;
}): OpenCodeProviderConfigSources {
  const providerId = input.providerId.trim();
  const cwd = input.cwd.trim();
  const customPath = process.env.OPENCODE_CONFIG?.trim()
    ? resolve(process.env.OPENCODE_CONFIG.trim())
    : null;

  const userCandidates = userConfigCandidates();
  const userPath = firstExistingPath(userCandidates);
  const projectCandidates = cwd.length > 0 ? projectConfigCandidates(cwd) : [];
  const projectPath = projectCandidates.length > 0 ? firstExistingPath(projectCandidates) : null;

  const userConfig = userPath ? readConfigIfExists(userPath) : null;
  const projectConfig = projectPath ? readConfigIfExists(projectPath) : null;
  const customConfig = customPath ? readConfigIfExists(customPath) : null;
  const authConfig = readConfigIfExists(join(openCodeDataDir(), "auth.json"));

  const authExists =
    isPlainObject(authConfig) && Object.prototype.hasOwnProperty.call(authConfig, providerId);

  return {
    auth: {
      exists: authExists,
      path: authExists ? join(openCodeDataDir(), "auth.json") : null,
    },
    user: {
      exists: userConfig !== null && providerConfiguredInConfig(userConfig, providerId),
      path: userPath,
    },
    project: {
      exists: projectConfig !== null && providerConfiguredInConfig(projectConfig, providerId),
      path: projectPath,
    },
    custom: {
      exists: customConfig !== null && providerConfiguredInConfig(customConfig, providerId),
      path: customPath,
    },
  };
}
