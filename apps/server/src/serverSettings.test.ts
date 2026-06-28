import * as NodeServices from "@effect/platform-node/NodeServices";
import { DEFAULT_MODEL_BY_PROVIDER } from "@t3tools/contracts";
import { Effect, FileSystem, Layer, Path } from "effect";
import { describe, expect, it } from "vitest";
import { ServerConfig } from "./config";
import {
  ServerSettingsLive,
  ServerSettingsService,
  migrateLegacyServerSettingsObject,
} from "./serverSettings";

const serverConfigLayer = ServerConfig.layerTest(process.cwd(), {
  prefix: "dpcode-settings-test-",
}).pipe(Layer.provide(NodeServices.layer));
const makeTestLayer = Layer.merge(NodeServices.layer, serverConfigLayer);
const testLayer = Layer.merge(makeTestLayer, ServerSettingsLive.pipe(Layer.provide(makeTestLayer)));

const runWithSettings = <A, E>(
  effect: Effect.Effect<
    A,
    E,
    ServerSettingsService | ServerConfig | FileSystem.FileSystem | Path.Path
  >,
) => Effect.runPromise(effect.pipe(Effect.provide(testLayer)) as Effect.Effect<A, E, never>);

describe("ServerSettingsService", () => {
  it("loads defaults when settings file does not exist", async () => {
    const settings = await runWithSettings(
      Effect.gen(function* () {
        const service = yield* ServerSettingsService;
        yield* service.start;
        return yield* service.getSettings;
      }),
    );

    expect(settings.providers.opencode.binaryPath).toBe("opencode");
    expect(settings.defaultThreadEnvMode).toBe("local");
    expect(settings.enableProviderUpdateChecks).toBe(true);
  });

  it("persists updates and reloads them", async () => {
    const result = await runWithSettings(
      Effect.gen(function* () {
        const service = yield* ServerSettingsService;
        const { settingsPath } = yield* ServerConfig;
        const fs = yield* FileSystem.FileSystem;
        yield* service.start;

        const updated = yield* service.updateSettings({
          enableAssistantStreaming: true,
          enableProviderUpdateChecks: false,
          providers: {
            opencode: {
              binaryPath: "/usr/local/bin/opencode",
              customModels: ["gpt-custom"],
            },
          },
        });
        const raw = yield* fs.readFileString(settingsPath);
        return { updated, parsed: JSON.parse(raw) as unknown };
      }),
    );

    expect(result.updated.enableAssistantStreaming).toBe(true);
    expect(result.updated.enableProviderUpdateChecks).toBe(false);
    expect(result.updated.providers.opencode.binaryPath).toBe("/usr/local/bin/opencode");
    expect(result.parsed).toMatchObject({
      enableAssistantStreaming: true,
      enableProviderUpdateChecks: false,
      providers: {
        opencode: {
          binaryPath: "/usr/local/bin/opencode",
          customModels: ["gpt-custom"],
        },
      },
    });
  });

  it("migrates legacy multi-provider settings.json on startup", async () => {
    const result = await runWithSettings(
      Effect.gen(function* () {
        const service = yield* ServerSettingsService;
        const { settingsPath } = yield* ServerConfig;
        const fs = yield* FileSystem.FileSystem;
        yield* fs.makeDirectory((yield* Path.Path).dirname(settingsPath), { recursive: true });
        yield* fs.writeFileString(
          settingsPath,
          `${JSON.stringify({
            enableAssistantStreaming: false,
            defaultThreadEnvMode: "local",
            textGenerationModelSelection: {
              provider: "cline",
              model: "claude-sonnet-4-6",
            },
            providers: {
              cline: {
                enabled: true,
                binaryPath: "",
                customModels: [],
              },
            },
            clineUpstreamProviders: {},
          })}\n`,
        );
        yield* service.start;
        const settings = yield* service.getSettings;
        const raw = yield* fs.readFileString(settingsPath);
        return { settings, parsed: JSON.parse(raw) as Record<string, unknown> };
      }),
    );

    expect(result.settings.textGenerationModelSelection.provider).toBe("opencode");
    expect(result.parsed).not.toHaveProperty("clineUpstreamProviders");
    expect(result.parsed.providers).toEqual({
      opencode: expect.objectContaining({ binaryPath: "opencode" }),
    });
  });

  it("migrateLegacyServerSettingsObject keeps valid opencode fields only", () => {
    const migrated = migrateLegacyServerSettingsObject({
      enableAssistantStreaming: true,
      textGenerationModelSelection: { provider: "opencode", model: "openai/gpt-5" },
      providers: {
        opencode: { enabled: true, binaryPath: "opencode", customModels: [] },
        cline: { enabled: true },
      },
      clineUpstreamProviders: {},
    }) as Record<string, unknown>;

    expect(migrated.enableAssistantStreaming).toBe(true);
    expect(migrated.textGenerationModelSelection).toEqual({
      provider: "opencode",
      model: "openai/gpt-5",
    });
    expect(migrated.providers).toEqual({
      opencode: { enabled: true, binaryPath: "opencode", customModels: [] },
    });
    expect(migrated).not.toHaveProperty("clineUpstreamProviders");
  });

  it("keeps opencode as the text generation provider when enabled", async () => {
    const settings = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* ServerSettingsService;
        return yield* service.getSettings;
      }).pipe(
        Effect.provide(
          ServerSettingsService.layerTest({
            textGenerationModelSelection: {
              provider: "opencode",
              model: DEFAULT_MODEL_BY_PROVIDER.opencode,
            },
          }),
        ),
      ),
    );

    expect(settings.textGenerationModelSelection.provider).toBe("opencode");
    expect(settings.textGenerationModelSelection.model).toBe(DEFAULT_MODEL_BY_PROVIDER.opencode);
  });
});
