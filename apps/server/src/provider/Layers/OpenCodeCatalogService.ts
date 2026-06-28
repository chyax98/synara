import { Effect, Layer } from "effect";
import type { OpencodeClient } from "@opencode-ai/sdk/v2";

import { ServerConfig } from "../../config.ts";
import {
  OPENCODE_CLI_SPEC,
  OpenCodeRuntime,
  OpenCodeRuntimeError,
  runOpenCodeSdk,
} from "../opencodeRuntime.ts";
import {
  OpenCodeCatalogService,
  type OpenCodeCatalogServiceShape,
} from "../Services/OpenCodeCatalogService.ts";

const DEFAULT_BINARY_PATH = "opencode";

type CatalogRequestInput = {
  readonly binaryPath?: string | undefined;
  readonly cwd?: string | undefined;
  readonly serverUrl?: string | undefined;
  readonly serverPassword?: string | undefined;
};

const unwrapSdkData = <A>(
  operation: string,
  response: { readonly data?: A | undefined },
): Effect.Effect<A, OpenCodeRuntimeError> => {
  const data = response.data;
  if (data === undefined) {
    return Effect.fail(
      new OpenCodeRuntimeError({
        operation,
        detail: `${operation} returned no data.`,
      }),
    );
  }
  return Effect.succeed(data);
};

const catalogDirectory = (input: CatalogRequestInput, fallbackCwd: string) => {
  const trimmed = input.cwd?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallbackCwd;
};

const make = Effect.gen(function* () {
  const openCodeRuntime = yield* OpenCodeRuntime;
  const serverConfig = yield* ServerConfig;

  const withSdkClient = <A>(
    input: CatalogRequestInput,
    fn: (client: OpencodeClient, directory: string) => Effect.Effect<A, OpenCodeRuntimeError>,
  ): Effect.Effect<A, OpenCodeRuntimeError> =>
    Effect.scoped(
      Effect.gen(function* () {
        const directory = catalogDirectory(input, serverConfig.cwd);
        const serverUrl = input.serverUrl?.trim();
        const serverPassword = input.serverPassword?.trim();
        const server = yield* openCodeRuntime.connectToOpenCodeServer({
          binaryPath: input.binaryPath?.trim() || DEFAULT_BINARY_PATH,
          cliSpec: OPENCODE_CLI_SPEC,
          cwd: directory,
          ...(serverUrl ? { serverUrl } : {}),
        });
        const client = openCodeRuntime.createOpenCodeSdkClient({
          baseUrl: server.url,
          directory,
          cliSpec: OPENCODE_CLI_SPEC,
          ...(server.external && serverPassword ? { serverPassword } : {}),
        });
        return yield* fn(client, directory);
      }),
    );

  const catalogOverview: OpenCodeCatalogServiceShape["catalogOverview"] = (input) =>
    withSdkClient(input, (client, directory) =>
      Effect.gen(function* () {
        const [listResponse, authResponse] = yield* Effect.all(
          [
            runOpenCodeSdk("provider.list", () => client.provider.list({ directory })),
            runOpenCodeSdk("provider.auth", () => client.provider.auth({ directory })),
          ],
          { concurrency: "unbounded" },
        );
        const availability = yield* unwrapSdkData("provider.list", listResponse);
        const authMethods = yield* unwrapSdkData("provider.auth", authResponse);
        return {
          availability: {
            all: availability.all,
            connected: availability.connected,
            default: availability.default,
          },
          authMethods,
        };
      }),
    );

  const configProviders: OpenCodeCatalogServiceShape["configProviders"] = (input) =>
    withSdkClient(input, (client, directory) =>
      Effect.gen(function* () {
        const response = yield* runOpenCodeSdk("config.providers", () =>
          client.config.providers({ directory }),
        );
        const data = yield* unwrapSdkData("config.providers", response);
        return {
          providers: data.providers,
          default: data.default,
        };
      }),
    );

  const providerAvailable: OpenCodeCatalogServiceShape["providerAvailable"] = (input) =>
    withSdkClient(input, (client, directory) =>
      Effect.gen(function* () {
        const response = yield* runOpenCodeSdk("provider.list", () =>
          client.provider.list({ directory }),
        );
        const data = yield* unwrapSdkData("provider.list", response);
        return {
          all: data.all,
          connected: data.connected,
          default: data.default,
        };
      }),
    );

  const providerAuth: OpenCodeCatalogServiceShape["providerAuth"] = (input) =>
    withSdkClient(input, (client, directory) =>
      Effect.gen(function* () {
        const response = yield* runOpenCodeSdk("provider.auth", () =>
          client.provider.auth({ directory }),
        );
        return yield* unwrapSdkData("provider.auth", response);
      }),
    );

  const authSet: OpenCodeCatalogServiceShape["authSet"] = (input) =>
    withSdkClient(
      {
        binaryPath: input.binaryPath,
        cwd: input.cwd,
        serverUrl: input.serverUrl,
        serverPassword: input.serverPassword,
      },
      (client) =>
        runOpenCodeSdk("auth.set", () =>
          client.auth.set({
            providerID: input.providerID,
            auth: { type: "api", key: input.apiKey },
          }),
        ).pipe(Effect.as({ ok: true as const })),
    );

  const authRemove: OpenCodeCatalogServiceShape["authRemove"] = (input) =>
    withSdkClient(
      {
        binaryPath: input.binaryPath,
        cwd: input.cwd,
        serverUrl: input.serverUrl,
        serverPassword: input.serverPassword,
      },
      (client) =>
        runOpenCodeSdk("auth.remove", () =>
          client.auth.remove({
            providerID: input.providerID,
          }),
        ).pipe(Effect.as({ ok: true as const })),
    );

  const oauthAuthorize: OpenCodeCatalogServiceShape["oauthAuthorize"] = (input) =>
    withSdkClient(
      {
        binaryPath: input.binaryPath,
        cwd: input.cwd,
        serverUrl: input.serverUrl,
        serverPassword: input.serverPassword,
      },
      (client, directory) =>
        Effect.gen(function* () {
          const response = yield* runOpenCodeSdk("provider.oauth.authorize", () =>
            client.provider.oauth.authorize({
              providerID: input.providerID,
              directory,
              method: input.method,
              ...(input.inputs ? { inputs: input.inputs } : {}),
            }),
          );
          const data = yield* unwrapSdkData("provider.oauth.authorize", response);
          return {
            url: data.url,
            method: data.method,
            instructions: data.instructions,
          };
        }),
    );

  const oauthCallback: OpenCodeCatalogServiceShape["oauthCallback"] = (input) =>
    withSdkClient(
      {
        binaryPath: input.binaryPath,
        cwd: input.cwd,
        serverUrl: input.serverUrl,
        serverPassword: input.serverPassword,
      },
      (client, directory) =>
        runOpenCodeSdk("provider.oauth.callback", () =>
          client.provider.oauth.callback({
            providerID: input.providerID,
            directory,
            method: input.method,
            ...(input.code ? { code: input.code } : {}),
          }),
        ).pipe(Effect.as({ ok: true as const })),
    );

  return {
    catalogOverview,
    configProviders,
    providerAvailable,
    providerAuth,
    authSet,
    authRemove,
    oauthAuthorize,
    oauthCallback,
  } satisfies OpenCodeCatalogServiceShape;
});

export const OpenCodeCatalogServiceLive = Layer.effect(OpenCodeCatalogService, make);
