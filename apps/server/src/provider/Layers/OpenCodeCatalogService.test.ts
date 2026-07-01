// FILE: OpenCodeCatalogService.test.ts
// Purpose: Drive shipped OpenCodeCatalogService methods via SDK mock + real fs layers.
// Layer: Server provider tests

import { existsSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import * as NodeServices from "@effect/platform-node/NodeServices";
import type { OpencodeClient } from "@opencode-ai/sdk/v2";
import { Effect, Layer } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ServerConfig } from "../../config.ts";
import { getOpenCodeProviderConfigSources } from "../openCodeConfigLayers.ts";
import {
  OpenCodeRuntime,
  OpenCodeRuntimeError,
  type OpenCodeInventory,
  type OpenCodeRuntimeShape,
} from "../opencodeRuntime.ts";
import { OpenCodeCatalogService } from "../Services/OpenCodeCatalogService.ts";
import { OpenCodeCatalogServiceLive } from "./OpenCodeCatalogService.ts";

type CatalogProviderRow = {
  readonly id: string;
  readonly name: string;
  readonly source?: string;
  readonly models?: Record<string, unknown>;
};

type CatalogMockState = {
  providerList: {
    all: CatalogProviderRow[];
    connected: string[];
    default: Record<string, string>;
  };
  configProviders: {
    providers: CatalogProviderRow[];
    default: Record<string, string>;
  };
  config: Record<string, unknown>;
  log: {
    authSet: Array<{ providerID: string; key: string }>;
    authRemove: string[];
    configUpdates: Record<string, unknown>[];
  };
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeStoredConfig(
  stored: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const nextProvider = {
    ...(isPlainObject(stored.provider) ? stored.provider : {}),
    ...(isPlainObject(patch.provider) ? patch.provider : {}),
  };
  return {
    ...stored,
    ...patch,
    ...(Object.keys(nextProvider).length > 0 ? { provider: nextProvider } : {}),
  };
}

function upsertConfigProviderRow(
  state: CatalogMockState,
  providerID: string,
  patch: Record<string, unknown>,
): void {
  const name =
    typeof patch.name === "string" && patch.name.trim().length > 0 ? patch.name.trim() : providerID;
  const models = isPlainObject(patch.models) ? patch.models : {};
  const row: CatalogProviderRow = { id: providerID, name, source: "config", models };

  const configIndex = state.configProviders.providers.findIndex((entry) => entry.id === providerID);
  if (configIndex >= 0) {
    state.configProviders.providers[configIndex] = {
      ...state.configProviders.providers[configIndex]!,
      ...row,
      models: { ...(state.configProviders.providers[configIndex]!.models ?? {}), ...models },
    };
  } else {
    state.configProviders.providers.push(row);
  }
}

function createCatalogRuntimeMock(state: CatalogMockState): OpenCodeRuntimeShape {
  const unexpected = (operation: string) =>
    Effect.fail(
      new OpenCodeRuntimeError({
        operation,
        detail: `Unexpected runtime operation: ${operation}`,
        cause: null,
      }),
    );

  const createOpenCodeSdkClient: OpenCodeRuntimeShape["createOpenCodeSdkClient"] = () =>
    ({
      provider: {
        list: async () => ({ data: state.providerList }),
        auth: async () => ({ data: {} }),
      },
      config: {
        get: async () => ({ data: state.config }),
        update: async (input: { config: Record<string, unknown> }) => {
          state.log.configUpdates.push(structuredClone(input.config));
          state.config = mergeStoredConfig(state.config, input.config);
          const providerPatch = input.config.provider;
          if (isPlainObject(providerPatch)) {
            for (const [providerID, providerConfig] of Object.entries(providerPatch)) {
              if (isPlainObject(providerConfig)) {
                upsertConfigProviderRow(state, providerID, providerConfig);
              }
            }
          }
          return { data: null };
        },
        providers: async () => ({ data: state.configProviders }),
      },
      auth: {
        set: async (input: { providerID: string; auth: { type: string; key: string } }) => {
          state.log.authSet.push({ providerID: input.providerID, key: input.auth.key });
          return { data: null };
        },
        remove: async (input: { providerID: string }) => {
          state.log.authRemove.push(input.providerID);
          return { data: null };
        },
      },
    }) as unknown as OpencodeClient;

  return {
    startOpenCodeServerProcess: () => unexpected("startOpenCodeServerProcess"),
    connectToOpenCodeServer: () =>
      Effect.succeed({
        url: "http://127.0.0.1:4099",
        exitCode: null,
        external: false,
      }),
    runOpenCodeCommand: () => unexpected("runOpenCodeCommand"),
    createOpenCodeSdkClient,
    loadOpenCodeInventory: () =>
      Effect.succeed({
        providerList: state.providerList,
        agents: [],
        consoleState: null,
      } as unknown as OpenCodeInventory),
    listOpenCodeCliModels: () => Effect.succeed([]),
    loadOpenCodeCredentialProviderIDs: () => Effect.succeed([]),
  };
}

function makeCatalogTestLayer(projectDir: string, runtime: OpenCodeRuntimeShape) {
  return Layer.mergeAll(
    NodeServices.layer,
    OpenCodeCatalogServiceLive.pipe(
      Layer.provide(ServerConfig.layerTest(projectDir, { prefix: "synara-catalog-service-" })),
      Layer.provide(Layer.succeed(OpenCodeRuntime, runtime)),
      Layer.provide(NodeServices.layer),
    ),
  );
}

describe("OpenCodeCatalogServiceLive (shipped service entry points)", () => {
  let projectDir: string | null = null;
  let state: CatalogMockState;

  beforeEach(() => {
    state = {
      providerList: {
        all: [{ id: "anthropic", name: "Anthropic", source: "api" }],
        connected: [],
        default: {},
      },
      configProviders: {
        providers: [],
        default: {},
      },
      config: {},
      log: {
        authSet: [],
        authRemove: [],
        configUpdates: [],
      },
    };
  });

  afterEach(async () => {
    if (projectDir) {
      await rm(projectDir, { recursive: true, force: true });
      projectDir = null;
    }
  });

  it("upsertCustomProvider issues authSet + configUpdate through the service", async () => {
    projectDir = await mkdtemp(join(tmpdir(), "synara-catalog-upsert-"));
    const layer = makeCatalogTestLayer(projectDir, createCatalogRuntimeMock(state));

    await Effect.runPromise(
      Effect.gen(function* () {
        const catalog = yield* OpenCodeCatalogService;
        const result = yield* catalog.upsertCustomProvider({
          binaryPath: "opencode",
          cwd: projectDir!,
          providerID: "my-proxy",
          name: "My Proxy",
          baseURL: "https://api.example.com/v1",
          apiKey: "sk-test",
          models: [{ id: "gpt-4o", name: "GPT-4o" }],
        });
        expect(result).toEqual({ ok: true });
      }).pipe(Effect.provide(layer)),
    );

    expect(state.log.authSet).toEqual([{ providerID: "my-proxy", key: "sk-test" }]);
    console.info("OBSERVATION: upsertCustomProvider.authSet", JSON.stringify(state.log.authSet));
    expect(state.log.configUpdates[0]).toEqual({
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

  it("configProviders reflects upsert while catalogOverview provider.list stays SDK-only", async () => {
    projectDir = await mkdtemp(join(tmpdir(), "synara-catalog-overview-"));
    const layer = makeCatalogTestLayer(projectDir, createCatalogRuntimeMock(state));

    await Effect.runPromise(
      Effect.gen(function* () {
        const catalog = yield* OpenCodeCatalogService;

        yield* catalog.upsertCustomProvider({
          binaryPath: "opencode",
          cwd: projectDir!,
          providerID: "my-proxy",
          name: "My Proxy",
          baseURL: "https://api.example.com/v1",
          models: [{ id: "gpt-4o", name: "GPT-4o" }],
        });

        const configProviders = yield* catalog.configProviders({
          binaryPath: "opencode",
          cwd: projectDir!,
        });
        expect(configProviders.providers.map((provider) => provider.id)).toContain("my-proxy");
        console.info(
          "OBSERVATION: afterUpsert.configProviders.ids",
          JSON.stringify(configProviders.providers.map((provider) => provider.id)),
        );

        const overview = yield* catalog.catalogOverview({
          binaryPath: "opencode",
          cwd: projectDir!,
        });
        expect(overview.availability.all.map((provider) => provider.id)).toEqual(["anthropic"]);
        console.info(
          "OBSERVATION: afterUpsert.catalogOverview.availability.sdkOnly",
          JSON.stringify(overview.availability.all.map((provider) => provider.id)),
        );
        console.info(
          "OBSERVATION: afterUpsert.clientMergeRequired",
          "useOpenCodeModelCatalog merges configProviders into sidebar",
        );
        const proxyProvider = configProviders.providers.find(
          (provider) => provider.id === "my-proxy",
        );
        expect(proxyProvider?.models).toEqual({ "gpt-4o": { name: "GPT-4o" } });
        console.info(
          "OBSERVATION: afterUpsert.configProviders.myProxyModels",
          JSON.stringify(proxyProvider?.models ?? null),
        );
      }).pipe(Effect.provide(layer)),
    );
  });

  it("providerDisconnect scope=project clears project opencode.json via service", async () => {
    projectDir = await mkdtemp(join(tmpdir(), "synara-catalog-disconnect-"));
    writeFileSync(
      join(projectDir, "opencode.json"),
      JSON.stringify({
        provider: {
          "my-proxy": { models: { "gpt-4o": { name: "GPT" } } },
        },
      }),
    );

    const layer = makeCatalogTestLayer(projectDir, createCatalogRuntimeMock(state));

    await Effect.runPromise(
      Effect.gen(function* () {
        const catalog = yield* OpenCodeCatalogService;
        const before = getOpenCodeProviderConfigSources({
          providerId: "my-proxy",
          cwd: projectDir!,
        });
        expect(before.project.exists).toBe(true);
        console.info("OBSERVATION: disconnect.before.project", JSON.stringify(before.project));

        const result = yield* catalog.providerDisconnect({
          binaryPath: "opencode",
          cwd: projectDir!,
          providerID: "my-proxy",
          scope: "project",
        });
        expect(result).toEqual({ ok: true, removed: true });

        const after = getOpenCodeProviderConfigSources({
          providerId: "my-proxy",
          cwd: projectDir!,
        });
        expect(after.project.exists).toBe(false);
        const configPath = join(projectDir!, "opencode.json");
        expect(existsSync(configPath)).toBe(false);
        console.info("OBSERVATION: disconnect.after.project", JSON.stringify(after.project));
        console.info("OBSERVATION: disconnect.projectFileUnlinked", !existsSync(configPath));
      }).pipe(Effect.provide(layer)),
    );
  });

  it("addProviderModel issues configUpdate patch through the service", async () => {
    projectDir = await mkdtemp(join(tmpdir(), "synara-catalog-add-model-"));
    const layer = makeCatalogTestLayer(projectDir, createCatalogRuntimeMock(state));

    await Effect.runPromise(
      Effect.gen(function* () {
        const catalog = yield* OpenCodeCatalogService;
        const result = yield* catalog.addProviderModel({
          binaryPath: "opencode",
          cwd: projectDir!,
          slug: "anthropic/claude-sonnet-4",
          displayName: "Sonnet",
        });
        expect(result).toEqual({ ok: true });
      }).pipe(Effect.provide(layer)),
    );

    expect(state.log.configUpdates[0]).toEqual({
      provider: {
        anthropic: {
          models: { "claude-sonnet-4": { name: "Sonnet" } },
        },
      },
    });
  });
});
