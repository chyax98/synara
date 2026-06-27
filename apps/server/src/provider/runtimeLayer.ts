import { Effect, FileSystem, Layer, Path } from "effect";
import { ChildProcessSpawner } from "effect/unstable/process";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { ServerConfig } from "../config";
import { ServerSettingsLive } from "../serverSettings";
import { AnalyticsService } from "../telemetry/Services/AnalyticsService";
import { makeEventNdjsonLogger } from "./Layers/EventNdjsonLogger";
import { makeOpenCodeAdapterLive } from "./Layers/OpenCodeAdapter";
import { ProviderDiscoveryServiceLive } from "./Layers/ProviderDiscoveryService";
import { makeProviderServiceLive } from "./Layers/ProviderService";
import { ProviderSessionDirectoryLive } from "./Layers/ProviderSessionDirectory";
import { ProviderDiscoveryService } from "./Services/ProviderDiscoveryService";
import { ProviderService } from "./Services/ProviderService";
import { ProviderSessionDirectory } from "./Services/ProviderSessionDirectory";
import { ProviderSessionRuntimeRepositoryLive } from "../persistence/Layers/ProviderSessionRuntime";

export function makeServerProviderLayer(): Layer.Layer<
  ProviderService | ProviderDiscoveryService | ProviderSessionDirectory,
  never,
  | SqlClient.SqlClient
  | ServerConfig
  | FileSystem.FileSystem
  | Path.Path
  | AnalyticsService
  | ChildProcessSpawner.ChildProcessSpawner
> {
  return Effect.gen(function* () {
    const { logProviderEvents, providerEventLogPath } = yield* ServerConfig;
    const nativeEventLogger = logProviderEvents
      ? yield* makeEventNdjsonLogger(providerEventLogPath, {
          stream: "native",
        })
      : undefined;
    const canonicalEventLogger = logProviderEvents
      ? yield* makeEventNdjsonLogger(providerEventLogPath, {
          stream: "canonical",
        })
      : undefined;
    const providerSessionDirectoryLayer = ProviderSessionDirectoryLive.pipe(
      Layer.provide(ProviderSessionRuntimeRepositoryLive),
    );
    const openCodeAdapterLayer = makeOpenCodeAdapterLive(
      nativeEventLogger ? { nativeEventLogger } : undefined,
    );
    const providerServiceLayer = makeProviderServiceLive(
      canonicalEventLogger ? { canonicalEventLogger } : undefined,
    ).pipe(Layer.provide(openCodeAdapterLayer), Layer.provide(providerSessionDirectoryLayer));
    const providerDiscoveryLayer = ProviderDiscoveryServiceLive.pipe(
      Layer.provide(openCodeAdapterLayer),
      Layer.provide(ServerSettingsLive),
    );
    return Layer.mergeAll(
      providerServiceLayer,
      providerDiscoveryLayer,
      openCodeAdapterLayer,
      providerSessionDirectoryLayer,
    );
  }).pipe(Layer.unwrap);
}
