#!/usr/bin/env bun
/**
 * Drives shipped OpenCodeCatalogService entry points and prints OBSERVATION blocks
 * for verification evidence (config-ux-*.log). No test mocks bypassing the service layer.
 */
import { existsSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import * as NodeServices from "@effect/platform-node/NodeServices";
import type { OpencodeClient } from "@opencode-ai/sdk/v2";
import { Effect, Layer } from "effect";

import { mergeCatalogAvailabilityWithConfigProviders } from "../apps/web/src/lib/mergeConfigProvidersIntoCatalog.ts";
import { ServerConfig } from "../apps/server/src/config.ts";
import { getOpenCodeProviderConfigSources } from "../apps/server/src/provider/openCodeConfigLayers.ts";
import {
  OpenCodeRuntime,
  OpenCodeRuntimeError,
  type OpenCodeInventory,
  type OpenCodeRuntimeShape,
} from "../apps/server/src/provider/opencodeRuntime.ts";
import { OpenCodeCatalogService } from "../apps/server/src/provider/Services/OpenCodeCatalogService.ts";
import { OpenCodeCatalogServiceLive } from "../apps/server/src/provider/Layers/OpenCodeCatalogService.ts";

type CatalogProviderRow = {
  readonly id: string;
  readonly name: string;
  readonly source?: string;
  readonly models?: Record<string, unknown>;
};

type DriveState = {
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
  state: DriveState,
  providerID: string,
  patch: Record<string, unknown>,
) {
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

function createDriveRuntime(state: DriveState): OpenCodeRuntimeShape {
  const unexpected = (operation: string) =>
    Effect.fail(
      new OpenCodeRuntimeError({ operation, detail: `Unexpected: ${operation}`, cause: null }),
    );

  return {
    startOpenCodeServerProcess: () => unexpected("startOpenCodeServerProcess"),
    connectToOpenCodeServer: () =>
      Effect.succeed({ url: "http://127.0.0.1:4099", exitCode: null, external: false }),
    runOpenCodeCommand: () => unexpected("runOpenCodeCommand"),
    createOpenCodeSdkClient: () =>
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
      }) as unknown as OpencodeClient,
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

function observe(label: string, value: unknown) {
  console.log(`OBSERVATION: ${label}: ${JSON.stringify(value, null, 0)}`);
}

async function runDrive(runId: number) {
  console.log(`=== CONFIG UX DRIVE run ${runId} ===`);
  const projectDir = await mkdtemp(join(tmpdir(), `synara-config-ux-drive-${runId}-`));
  const state: DriveState = {
    providerList: {
      all: [{ id: "anthropic", name: "Anthropic", source: "api" }],
      connected: [],
      default: {},
    },
    configProviders: { providers: [], default: {} },
    config: {},
    log: { authSet: [], authRemove: [], configUpdates: [] },
  };

  const layer = Layer.mergeAll(
    NodeServices.layer,
    OpenCodeCatalogServiceLive.pipe(
      Layer.provide(ServerConfig.layerTest(projectDir, { prefix: "synara-config-ux-drive-" })),
      Layer.provide(Layer.succeed(OpenCodeRuntime, createDriveRuntime(state))),
      Layer.provide(NodeServices.layer),
    ),
  );

  try {
    await Effect.runPromise(
      Effect.gen(function* () {
        const catalog = yield* OpenCodeCatalogService;

        observe(
          "clean-state.providerList.all",
          state.providerList.all.map((p) => p.id),
        );
        observe(
          "clean-state.configProviders",
          state.configProviders.providers.map((p) => p.id),
        );

        yield* catalog.upsertCustomProvider({
          binaryPath: "opencode",
          cwd: projectDir,
          providerID: "my-proxy",
          name: "My Proxy",
          baseURL: "https://api.example.com/v1",
          apiKey: "sk-drive-test",
          models: [{ id: "gpt-4o", name: "GPT-4o" }],
        });

        observe("after-upsert.authSet", state.log.authSet);
        observe("after-upsert.configUpdateCount", state.log.configUpdates.length);
        observe(
          "after-upsert.configUpdate.providerKeys",
          Object.keys(
            (state.log.configUpdates[0]?.provider as Record<string, unknown> | undefined) ?? {},
          ),
        );

        const configProviders = yield* catalog.configProviders({
          binaryPath: "opencode",
          cwd: projectDir,
        });
        observe(
          "after-upsert.configProviders.ids",
          configProviders.providers.map((provider) => provider.id),
        );

        const overview = yield* catalog.catalogOverview({
          binaryPath: "opencode",
          cwd: projectDir,
        });
        const sdkAvailability = overview.availability.all.map((provider) => ({
          id: provider.id,
          name: provider.name,
        }));
        observe(
          "after-upsert.catalogOverview.availability.sdkOnly",
          sdkAvailability.map((p) => p.id),
        );
        observe(
          "after-upsert.clientMergedAvailability",
          mergeCatalogAvailabilityWithConfigProviders(
            sdkAvailability,
            configProviders.providers,
          ).map((provider) => provider.id),
        );

        writeFileSync(
          join(projectDir, "opencode.json"),
          JSON.stringify({
            provider: { "my-proxy": { models: { "gpt-4o": { name: "GPT" } } } },
          }),
        );
        const sourcesBefore = getOpenCodeProviderConfigSources({
          providerId: "my-proxy",
          cwd: projectDir,
        });
        observe("fs-sources.beforeDisconnect.project", sourcesBefore.project);

        const disconnect = yield* catalog.providerDisconnect({
          binaryPath: "opencode",
          cwd: projectDir,
          providerID: "my-proxy",
          scope: "project",
        });
        observe("disconnect.project.result", disconnect);

        const sourcesAfter = getOpenCodeProviderConfigSources({
          providerId: "my-proxy",
          cwd: projectDir,
        });
        observe("fs-sources.afterDisconnect.project", sourcesAfter.project);
        const projectConfigPath = join(projectDir, "opencode.json");
        observe("disconnect.projectFileUnlinked", !existsSync(projectConfigPath));

        yield* catalog.addProviderModel({
          binaryPath: "opencode",
          cwd: projectDir,
          slug: "anthropic/claude-sonnet-4",
          displayName: "Sonnet",
        });
        observe("addProviderModel.lastPatch", state.log.configUpdates.at(-1)?.provider ?? null);
      }).pipe(Effect.provide(layer)),
    );

    console.log(`OBSERVATION: drive-run-${runId}-status: PASS`);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
}

const runId = Number(process.argv[2] ?? "1");
await runDrive(runId);
