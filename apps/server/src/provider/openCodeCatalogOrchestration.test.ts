// FILE: openCodeCatalogOrchestration.test.ts
// Purpose: Drive shipped orchestration entry points via injected ports (AC5 / verification step 2).
// Layer: Server provider tests

import { readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  getOpenCodeProviderConfigSources,
  removeOpenCodeProviderConfig,
  removeOpenCodeProviderModel,
} from "./openCodeConfigLayers.ts";
import {
  orchestrateAddProviderModel,
  orchestrateProviderDisconnect,
  orchestrateRemoveProviderModel,
  orchestrateUpsertCustomProvider,
  type OpenCodeCatalogOrchestrationPorts,
} from "./openCodeCatalogOrchestration.ts";

type PortCallLog = {
  authSet: Array<{ providerID: string; apiKey: string }>;
  authRemove: string[];
  configUpdates: Record<string, unknown>[];
  configGetResponses: Array<{ config: Record<string, unknown> }>;
};

function makeTrackedPorts(input: {
  cwd: string;
  log: PortCallLog;
  initialConfig?: Record<string, unknown>;
  authExists?: boolean;
}): OpenCodeCatalogOrchestrationPorts {
  let storedConfig = input.initialConfig ?? {};
  return {
    cwd: input.cwd,
    configGet: async () => {
      const snapshot = { config: structuredClone(storedConfig) };
      input.log.configGetResponses.push(snapshot);
      return snapshot;
    },
    configUpdate: async (config) => {
      input.log.configUpdates.push(structuredClone(config));
      storedConfig = {
        ...storedConfig,
        ...config,
        provider: {
          ...(typeof storedConfig.provider === "object" && storedConfig.provider !== null
            ? (storedConfig.provider as Record<string, unknown>)
            : {}),
          ...(typeof config.provider === "object" && config.provider !== null
            ? (config.provider as Record<string, unknown>)
            : {}),
        },
      };
      return { ok: true };
    },
    authSet: async (providerID, apiKey) => {
      input.log.authSet.push({ providerID, apiKey });
      return { ok: true };
    },
    authRemove: async (providerID) => {
      input.log.authRemove.push(providerID);
      return { ok: true };
    },
    getSources: (providerID) => {
      const sources = getOpenCodeProviderConfigSources({ providerId: providerID, cwd: input.cwd });
      if (input.authExists) {
        return { ...sources, auth: { exists: true, path: "/fake/auth.json" } };
      }
      return sources;
    },
    removeProviderConfigLayer: ({ providerId, scope }) =>
      removeOpenCodeProviderConfig({ providerId, cwd: input.cwd, scope }),
    removeProviderModelLayer: ({ providerId, modelId, scope }) =>
      removeOpenCodeProviderModel({ providerId, modelId, cwd: input.cwd, scope }),
  };
}

describe("openCodeCatalogOrchestration (shipped mutation sequencing)", () => {
  let projectDir: string | null = null;

  afterEach(async () => {
    if (projectDir) {
      await rm(projectDir, { recursive: true, force: true });
      projectDir = null;
    }
  });

  it("upsertCustomProvider calls authSet then configUpdate with OpenAI-compatible patch", async () => {
    const log: PortCallLog = {
      authSet: [],
      authRemove: [],
      configUpdates: [],
      configGetResponses: [],
    };
    const ports = makeTrackedPorts({ cwd: "/tmp", log });

    const result = await orchestrateUpsertCustomProvider({
      providerID: "my-proxy",
      name: "My Proxy",
      baseURL: "https://api.example.com/v1",
      apiKey: "sk-test",
      models: [{ id: "gpt-4o", name: "GPT-4o" }],
      ports,
    });

    expect(result).toEqual({ ok: true });
    expect(log.authSet).toEqual([{ providerID: "my-proxy", apiKey: "sk-test" }]);
    expect(log.configUpdates[0]).toEqual({
      provider: {
        "my-proxy": {
          npm: "@ai-sdk/openai-compatible",
          name: "My Proxy",
          options: { baseURL: "https://api.example.com/v1" },
          models: { "gpt-4o": { name: "GPT-4o" } },
        },
      },
    });
  });

  it("addProviderModel issues configUpdate patch for providerID/modelID slug", async () => {
    const log: PortCallLog = {
      authSet: [],
      authRemove: [],
      configUpdates: [],
      configGetResponses: [],
    };
    const ports = makeTrackedPorts({ cwd: "/tmp", log });

    await orchestrateAddProviderModel({
      slug: "anthropic/claude-sonnet-4",
      displayName: "Sonnet",
      ports,
    });

    expect(log.configUpdates[0]).toEqual({
      provider: {
        anthropic: {
          models: { "claude-sonnet-4": { name: "Sonnet" } },
        },
      },
    });
  });

  it("providerDisconnect scope=user clears project layer and post-mutation sources show removed", async () => {
    projectDir = await mkdtemp(join(tmpdir(), "synara-orch-disconnect-"));
    writeFileSync(
      join(projectDir, "opencode.json"),
      JSON.stringify({
        provider: {
          "my-proxy": { models: { "gpt-4o": { name: "GPT" } } },
        },
      }),
    );

    const log: PortCallLog = {
      authSet: [],
      authRemove: [],
      configUpdates: [],
      configGetResponses: [],
    };
    const ports = makeTrackedPorts({ cwd: projectDir, log });

    const before = ports.getSources("my-proxy");
    expect(before.project.exists).toBe(true);

    const result = await orchestrateProviderDisconnect({
      providerID: "my-proxy",
      scope: "user",
      ports,
    });

    expect(result.removed).toBe(false);
    const after = ports.getSources("my-proxy");
    expect(after.project.exists).toBe(true);

    const projectResult = await orchestrateProviderDisconnect({
      providerID: "my-proxy",
      scope: "project",
      ports,
    });
    expect(projectResult.removed).toBe(true);
    const afterProject = ports.getSources("my-proxy");
    expect(afterProject.project.exists).toBe(false);
  });

  it("providerDisconnect scope=all removes auth via authRemove when auth layer exists", async () => {
    const log: PortCallLog = {
      authSet: [],
      authRemove: [],
      configUpdates: [],
      configGetResponses: [],
    };
    const ports = makeTrackedPorts({ cwd: "/tmp", log, authExists: true });

    const result = await orchestrateProviderDisconnect({
      providerID: "anthropic",
      scope: "all",
      ports,
    });

    expect(result.removed).toBe(true);
    expect(log.authRemove).toEqual(["anthropic"]);
  });

  it("removeProviderModel prefers configUpdate patch then falls back to fs layers", async () => {
    const log: PortCallLog = {
      authSet: [],
      authRemove: [],
      configUpdates: [],
      configGetResponses: [],
    };
    const ports = makeTrackedPorts({
      cwd: "/tmp",
      log,
      initialConfig: {
        provider: {
          anthropic: {
            models: {
              "claude-sonnet-4": { name: "Sonnet" },
              "claude-opus-4": { name: "Opus" },
            },
          },
        },
      },
    });

    await orchestrateRemoveProviderModel({
      slug: "anthropic/claude-sonnet-4",
      ports,
    });

    expect(log.configUpdates[0]?.provider).toEqual({
      anthropic: {
        models: { "claude-opus-4": { name: "Opus" } },
      },
    });

    projectDir = await mkdtemp(join(tmpdir(), "synara-orch-remove-model-"));
    writeFileSync(
      join(projectDir, "opencode.json"),
      JSON.stringify({
        provider: {
          "my-proxy": { models: { "gpt-4o": { name: "GPT" } } },
        },
      }),
    );
    const fsLog: PortCallLog = {
      authSet: [],
      authRemove: [],
      configUpdates: [],
      configGetResponses: [],
    };
    const fsPorts = makeTrackedPorts({ cwd: projectDir, log: fsLog, initialConfig: {} });

    await orchestrateRemoveProviderModel({
      slug: "my-proxy/gpt-4o",
      scope: "project",
      ports: fsPorts,
    });

    expect(fsLog.configUpdates).toHaveLength(0);
    const projectConfig = JSON.parse(readFileSync(join(projectDir, "opencode.json"), "utf8")) as {
      provider?: Record<string, { models?: Record<string, unknown> }>;
    };
    expect(projectConfig.provider?.["my-proxy"]?.models?.["gpt-4o"]).toBeUndefined();
  });
});
