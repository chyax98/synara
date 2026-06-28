/**
 * ProviderHealthLive - OpenCode-only provider health service.
 *
 * Seeds provider status from disk cache when available, then refreshes from
 * an OpenCode CLI probe without blocking the rest of server startup.
 */
import {
  DEFAULT_SERVER_SETTINGS,
  type ProviderKind,
  type ServerSettings,
  type ServerProviderStatus,
  type ServerProviderUpdateResult,
  type ServerProviderUpdateState,
} from "@t3tools/contracts";
import { ServerProviderUpdateError } from "@t3tools/contracts";
import { prepareWindowsSafeProcess } from "@t3tools/shared/windowsProcess";
import { Effect, FileSystem, Layer, Option, Path, PubSub, Ref, Result, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { ServerConfig } from "../../config";
import { ServerSettingsService } from "../../serverSettings";
import { isWindowsShellCommandMissingResult } from "../../shell-command-detection";
import { ProviderHealth, type ProviderHealthShape } from "../Services/ProviderHealth";
import {
  orderProviderStatuses,
  readProviderStatusCache,
  resolveProviderStatusCachePath,
  writeProviderStatusCache,
} from "../providerStatusCache";
import { makeProviderMaintenanceCommandCoordinator } from "../providerMaintenanceCommandCoordinator";
import {
  enrichProviderStatusWithVersionAdvisory,
  makeProviderMaintenanceCapabilities,
  normalizeCommandPath,
  parseGenericCliVersion,
  resolveProviderMaintenanceCapabilitiesEffect,
} from "../providerMaintenance";
import { collectUint8StreamText } from "../../stream/collectUint8StreamText";

const OPENCODE_PROVIDER = "opencode" as const;
const OPENCODE_HEALTH_TIMEOUT_MS = 20_000;
const PROVIDER_COMMAND_TIMEOUT_DETAIL = "Timed out while running command.";
const PROVIDERS = [OPENCODE_PROVIDER] as const satisfies ReadonlyArray<ProviderKind>;
const DISABLED_PROVIDER_STATUS_MESSAGE = "Provider is disabled in Synara settings.";
const UPDATE_OUTPUT_MAX_BYTES = 10_000;
const UPDATE_TIMEOUT_MS = 5 * 60_000;

type ProviderStatuses = ReadonlyArray<ServerProviderStatus>;

export interface CommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number;
}

function nonEmptyTrimmed(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isCommandMissingCause(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const lower = error.message.toLowerCase();
  return lower.includes("enoent") || lower.includes("notfound");
}

function detailFromResult(
  result: CommandResult & { readonly timedOut?: boolean },
): string | undefined {
  if (result.timedOut) return PROVIDER_COMMAND_TIMEOUT_DETAIL;
  const stderr = nonEmptyTrimmed(result.stderr);
  if (stderr) return stderr;
  const stdout = nonEmptyTrimmed(result.stdout);
  if (stdout) return stdout;
  if (result.code !== 0) {
    return `Command exited with code ${result.code}.`;
  }
  return undefined;
}

function isOpenCodeNativeCommandPath(commandPath: string): boolean {
  const normalized = normalizeCommandPath(commandPath);
  return (
    normalized.endsWith("/.opencode/bin/opencode") ||
    normalized.endsWith("/.opencode/bin/opencode.exe")
  );
}

const runOpenCodeCommand = (args: ReadonlyArray<string>, executable = "opencode") =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const prepared = prepareWindowsSafeProcess(executable, args, { env: process.env });
    const command = ChildProcess.make(prepared.command, prepared.args, {
      shell: prepared.shell,
      env: process.env,
    });
    const child = yield* spawner.spawn(command);
    const [stdout, stderr, exitCode] = yield* Effect.all(
      [
        Stream.runFold(
          child.stdout,
          () => "",
          (acc, chunk) => acc + new TextDecoder().decode(chunk),
        ),
        Stream.runFold(
          child.stderr,
          () => "",
          (acc, chunk) => acc + new TextDecoder().decode(chunk),
        ),
        child.exitCode.pipe(Effect.map(Number)),
      ],
      { concurrency: "unbounded" },
    );
    return { stdout, stderr, code: exitCode } satisfies CommandResult;
  }).pipe(
    Effect.scoped,
    Effect.flatMap((result) =>
      isWindowsShellCommandMissingResult({ code: result.code, stderr: result.stderr })
        ? Effect.fail(new Error(`spawn ${executable} ENOENT`))
        : Effect.succeed(result),
    ),
  );

export const makeCheckOpenCodeProviderStatus = (
  binaryPath?: string,
): Effect.Effect<ServerProviderStatus, never, ChildProcessSpawner.ChildProcessSpawner> =>
  Effect.gen(function* () {
    const checkedAt = new Date().toISOString();
    const executable = nonEmptyTrimmed(binaryPath) ?? "opencode";

    const versionProbe = yield* runOpenCodeCommand(["--version"], executable).pipe(
      Effect.timeoutOption(OPENCODE_HEALTH_TIMEOUT_MS),
      Effect.result,
    );

    if (Result.isFailure(versionProbe)) {
      const error = versionProbe.failure;
      return {
        provider: OPENCODE_PROVIDER,
        status: "error" as const,
        available: false,
        authStatus: "unknown" as const,
        checkedAt,
        message: isCommandMissingCause(error)
          ? "OpenCode CLI (`opencode`) is not installed or not on PATH."
          : `Failed to execute OpenCode CLI health check: ${error instanceof Error ? error.message : String(error)}.`,
      } satisfies ServerProviderStatus;
    }

    if (Option.isNone(versionProbe.success)) {
      return {
        provider: OPENCODE_PROVIDER,
        status: "error" as const,
        available: false,
        authStatus: "unknown" as const,
        checkedAt,
        message: `OpenCode CLI is installed but failed to run. ${PROVIDER_COMMAND_TIMEOUT_DETAIL}`,
      } satisfies ServerProviderStatus;
    }

    const version = versionProbe.success.value;
    if (version.code !== 0) {
      const detail = detailFromResult(version);
      return {
        provider: OPENCODE_PROVIDER,
        status: "error" as const,
        available: false,
        authStatus: "unknown" as const,
        checkedAt,
        message: detail
          ? `OpenCode CLI is installed but failed to run. ${detail}`
          : "OpenCode CLI is installed but failed to run.",
      } satisfies ServerProviderStatus;
    }

    const parsedVersion = parseGenericCliVersion(`${version.stdout}\n${version.stderr}`);
    return {
      provider: OPENCODE_PROVIDER,
      status: "ready" as const,
      available: true,
      authStatus: "unknown" as const,
      version: parsedVersion,
      checkedAt,
      message:
        "OpenCode CLI is installed. Configure provider credentials inside OpenCode as needed.",
    } satisfies ServerProviderStatus;
  });

export const checkOpenCodeProviderStatus = makeCheckOpenCodeProviderStatus();

export function providerStatusesEqual(
  left: ReadonlyArray<ServerProviderStatus>,
  right: ReadonlyArray<ServerProviderStatus>,
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((status, index) => {
    const next = right[index];
    return (
      next !== undefined &&
      status.provider === next.provider &&
      status.status === next.status &&
      status.available === next.available &&
      status.authStatus === next.authStatus &&
      (status.version ?? null) === (next.version ?? null) &&
      (status.message ?? null) === (next.message ?? null)
    );
  });
}

function isTransientProviderCommandTimeout(status: ServerProviderStatus): boolean {
  return (
    status.status !== "ready" &&
    status.authStatus === "unknown" &&
    (status.message ?? "").includes(PROVIDER_COMMAND_TIMEOUT_DETAIL)
  );
}

function wasPreviouslyUsableProviderStatus(status: ServerProviderStatus): boolean {
  return status.available && status.status === "ready";
}

export function stabilizeProviderStatusesAgainstTransientTimeouts(
  previousStatuses: ReadonlyArray<ServerProviderStatus>,
  nextStatuses: ReadonlyArray<ServerProviderStatus>,
): ReadonlyArray<ServerProviderStatus> {
  if (previousStatuses.length === 0) {
    return nextStatuses;
  }

  const previousByProvider = new Map(
    previousStatuses.map((status) => [status.provider, status] as const),
  );

  return nextStatuses.map((status) => {
    const previous = previousByProvider.get(status.provider);
    if (
      !previous ||
      !wasPreviouslyUsableProviderStatus(previous) ||
      !isTransientProviderCommandTimeout(status)
    ) {
      return status;
    }

    return {
      ...previous,
      checkedAt: status.checkedAt,
      ...(status.updateState !== undefined ? { updateState: status.updateState } : {}),
    };
  });
}

export function isProviderEnabledForSettings(
  provider: ProviderKind,
  settings: ServerSettings,
): boolean {
  return settings.providers[provider].enabled !== false;
}

export function makeDisabledProviderStatus(
  provider: ProviderKind,
  checkedAt = new Date().toISOString(),
): ServerProviderStatus {
  return {
    provider,
    status: "warning" as const,
    available: false,
    authStatus: "unknown" as const,
    checkedAt,
    message: DISABLED_PROVIDER_STATUS_MESSAGE,
  } satisfies ServerProviderStatus;
}

function isDisabledProviderStatusOverlay(status: ServerProviderStatus): boolean {
  return status.message === DISABLED_PROVIDER_STATUS_MESSAGE && status.available === false;
}

// Keeps local CLI version/status visible while removing network-backed update metadata.
function makeSuppressedProviderVersionAdvisory(
  status: ServerProviderStatus,
  currentVersion?: string | null,
): NonNullable<ServerProviderStatus["versionAdvisory"]> {
  return {
    status: "unknown",
    currentVersion: currentVersion ?? status.version ?? null,
    latestVersion: null,
    updateCommand: null,
    canUpdate: false,
    checkedAt: status.checkedAt,
    message: null,
  };
}

function suppressProviderVersionAdvisory(status: ServerProviderStatus): ServerProviderStatus {
  return {
    ...status,
    versionAdvisory: makeSuppressedProviderVersionAdvisory(status),
  };
}

// Disabled providers are a settings overlay, not a probe result. Keep the raw
// cached/probed status intact so re-enabling a provider can reuse it immediately.
export function projectProviderStatusesForSettings(
  statuses: ReadonlyArray<ServerProviderStatus>,
  settings: ServerSettings,
  checkedAt = new Date().toISOString(),
): ProviderStatuses {
  const statusByProvider = new Map(statuses.map((status) => [status.provider, status] as const));
  const projected: ServerProviderStatus[] = [];

  for (const provider of PROVIDERS) {
    const status = statusByProvider.get(provider);
    if (!isProviderEnabledForSettings(provider, settings)) {
      const disabledStatus = makeDisabledProviderStatus(provider, status?.checkedAt ?? checkedAt);
      const disabledStatusWithAdvisory = {
        ...disabledStatus,
        versionAdvisory: makeSuppressedProviderVersionAdvisory(disabledStatus, status?.version),
      } satisfies ServerProviderStatus;
      projected.push(
        status?.updateState
          ? { ...disabledStatusWithAdvisory, updateState: status.updateState }
          : disabledStatusWithAdvisory,
      );
      continue;
    }

    if (status && !isDisabledProviderStatusOverlay(status)) {
      projected.push(
        settings.enableProviderUpdateChecks ? status : suppressProviderVersionAdvisory(status),
      );
    }
  }

  return orderProviderStatuses(projected);
}

export const ProviderHealthLive = Layer.effect(
  ProviderHealth,
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const serverConfig = yield* ServerConfig;
    const serverSettings = yield* ServerSettingsService;
    const changesPubSub = yield* PubSub.unbounded<ReadonlyArray<ServerProviderStatus>>();
    const cachePath = resolveProviderStatusCachePath({
      stateDir: serverConfig.stateDir,
      provider: OPENCODE_PROVIDER,
    });

    const cachedStatus = yield* readProviderStatusCache(cachePath).pipe(
      Effect.provideService(FileSystem.FileSystem, fileSystem),
    );
    const cachedStatuses: ProviderStatuses = orderProviderStatuses(
      cachedStatus && !isDisabledProviderStatusOverlay(cachedStatus) ? [cachedStatus] : [],
    );

    const statusesRef = yield* Ref.make<ProviderStatuses>(cachedStatuses);
    const updateStatesRef = yield* Ref.make<ReadonlyMap<ProviderKind, ServerProviderUpdateState>>(
      new Map(),
    );
    const commandCoordinator = yield* makeProviderMaintenanceCommandCoordinator({
      makeAlreadyRunningError: (provider) =>
        new ServerProviderUpdateError({
          provider: provider as ProviderKind,
          reason: "An update is already running for this provider.",
        }),
    });

    const getProviderMaintenanceCapabilities = Effect.fn("getProviderMaintenanceCapabilities")(
      function* () {
        const settings = yield* serverSettings.getSettings;
        if (!isProviderEnabledForSettings(OPENCODE_PROVIDER, settings)) {
          return makeProviderMaintenanceCapabilities({
            provider: OPENCODE_PROVIDER,
            packageName: null,
            latestVersionSource: null,
            updateExecutable: null,
            updateArgs: [],
            updateLockKey: null,
          });
        }
        return yield* resolveProviderMaintenanceCapabilitiesEffect(
          {
            provider: OPENCODE_PROVIDER,
            binaryName: "opencode",
            npmPackageName: "opencode-ai",
            homebrew: { name: "anomalyco/tap/opencode", kind: "formula" },
            latestVersionSource: { kind: "npm", name: "opencode-ai" },
            nativeUpdate: {
              executable: "opencode",
              args: (installSource) =>
                installSource === "unknown" || installSource === "native"
                  ? ["upgrade"]
                  : ["upgrade", "--method", installSource],
              lockKey: "opencode-native",
              strategy: "always",
              excludedInstallSources: ["homebrew"],
              isCommandPath: isOpenCodeNativeCommandPath,
            },
          },
          {
            binaryPath: settings.providers.opencode.binaryPath,
            env: process.env,
            platform: process.platform,
          },
        ).pipe(Effect.provideService(FileSystem.FileSystem, fileSystem));
      },
    );

    const applyVolatileProviderState = Effect.fn("applyVolatileProviderState")(function* (
      status: ServerProviderStatus,
    ) {
      const updateStates = yield* Ref.get(updateStatesRef);
      const updateState = updateStates.get(status.provider);
      if (!updateState) {
        const { updateState: _updateState, ...statusWithoutUpdateState } = status;
        return statusWithoutUpdateState;
      }
      return { ...status, updateState };
    });

    const projectStatusesForCurrentSettings = Effect.fn(
      "projectProviderStatusesForCurrentSettings",
    )(function* (statuses: ReadonlyArray<ServerProviderStatus>) {
      return yield* serverSettings.getSettings.pipe(
        Effect.map((settings) => projectProviderStatusesForSettings(statuses, settings)),
        Effect.catch(() => Effect.succeed(statuses)),
        Effect.flatMap((projected) =>
          Effect.forEach(projected, applyVolatileProviderState, {
            concurrency: "unbounded",
          }),
        ),
      );
    });

    const publishProjectedStatuses = Effect.fn("publishProjectedProviderStatuses")(function* () {
      const rawStatuses = yield* Ref.get(statusesRef);
      const projectedStatuses = yield* projectStatusesForCurrentSettings(rawStatuses);
      yield* PubSub.publish(changesPubSub, projectedStatuses);
      return projectedStatuses;
    });

    const setProviderUpdateState = Effect.fn("setProviderUpdateState")(function* (
      state: ServerProviderUpdateState | null,
    ) {
      yield* Ref.update(updateStatesRef, (previous) => {
        const next = new Map(previous);
        if (!state || state.status === "idle") {
          next.delete(OPENCODE_PROVIDER);
        } else {
          next.set(OPENCODE_PROVIDER, state);
        }
        return next;
      });
      return yield* publishProjectedStatuses();
    });

    const enrichStatuses = Effect.fn("enrichProviderStatuses")(function* (
      statuses: ReadonlyArray<ServerProviderStatus>,
    ) {
      const settings = yield* serverSettings.ready.pipe(
        Effect.flatMap(() => serverSettings.getSettings),
        Effect.catch(() => Effect.succeed(null)),
      );
      if (settings?.enableProviderUpdateChecks === false) {
        return yield* Effect.forEach(
          statuses.map(suppressProviderVersionAdvisory),
          applyVolatileProviderState,
          { concurrency: "unbounded" },
        );
      }

      const enriched = yield* Effect.forEach(
        statuses,
        (status) =>
          getProviderMaintenanceCapabilities().pipe(
            Effect.flatMap((capabilities) =>
              enrichProviderStatusWithVersionAdvisory(status, capabilities),
            ),
            Effect.catch(() => Effect.succeed(status)),
          ),
        { concurrency: "unbounded" },
      );
      return yield* Effect.forEach(enriched, applyVolatileProviderState, {
        concurrency: "unbounded",
      });
    });

    const checkProviderWhenEnabled = <R>(
      settings: ServerSettings,
      provider: ProviderKind,
      check: Effect.Effect<ServerProviderStatus, never, R>,
    ): Effect.Effect<Option.Option<ServerProviderStatus>, never, R> =>
      isProviderEnabledForSettings(provider, settings)
        ? check.pipe(Effect.map(Option.some))
        : Effect.succeed(Option.none());

    const loadProviderStatuses = serverSettings.ready.pipe(
      Effect.flatMap(() => serverSettings.getSettings),
      Effect.catch(() => Effect.succeed(DEFAULT_SERVER_SETTINGS)),
      Effect.flatMap((settings) =>
        checkProviderWhenEnabled(
          settings,
          OPENCODE_PROVIDER,
          makeCheckOpenCodeProviderStatus(settings.providers.opencode.binaryPath),
        ),
      ),
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
      Effect.map((status) => orderProviderStatuses(Option.isSome(status) ? [status.value] : [])),
      Effect.flatMap(enrichStatuses),
    );

    const persistStatuses = (statuses: ProviderStatuses) =>
      Effect.forEach(
        statuses,
        (status) => {
          const { updateState: _updateState, ...statusToPersist } = status;
          return writeProviderStatusCache({
            filePath: cachePath,
            provider: statusToPersist,
          }).pipe(
            Effect.provideService(FileSystem.FileSystem, fileSystem),
            Effect.provideService(Path.Path, path),
            Effect.tapError(Effect.logError),
            Effect.ignore,
          );
        },
        { concurrency: "unbounded", discard: true },
      );

    const refreshNow = Effect.gen(function* () {
      const loadedStatuses = yield* loadProviderStatuses;
      const previousRawStatuses = yield* Ref.get(statusesRef);
      const previousStatuses = yield* projectStatusesForCurrentSettings(previousRawStatuses);
      const stabilizedLoadedStatuses = stabilizeProviderStatusesAgainstTransientTimeouts(
        previousRawStatuses,
        loadedStatuses,
      );
      const nextRawStatuses = stabilizedLoadedStatuses;
      const nextStatuses = yield* projectStatusesForCurrentSettings(nextRawStatuses);
      yield* Ref.set(statusesRef, nextRawStatuses);
      if (providerStatusesEqual(previousStatuses, nextStatuses)) {
        return nextStatuses;
      }
      yield* persistStatuses(nextRawStatuses);
      yield* PubSub.publish(changesPubSub, nextStatuses);
      return nextStatuses;
    });

    yield* Effect.forkScoped(refreshNow);

    yield* serverSettings.streamChanges.pipe(
      Stream.runForEach(() => publishProjectedStatuses().pipe(Effect.asVoid)),
      Effect.forkScoped,
    );

    const refresh: Effect.Effect<ProviderStatuses> = refreshNow;

    const updateProvider: ProviderHealthShape["updateProvider"] = (input) => {
      const toUpdateError = (cause: unknown) =>
        new ServerProviderUpdateError({
          provider: input.provider,
          reason: cause instanceof Error ? cause.message : String(cause),
        });
      return Effect.gen(function* () {
        if (input.provider !== OPENCODE_PROVIDER) {
          return yield* new ServerProviderUpdateError({
            provider: input.provider,
            reason: "Only OpenCode updates are supported.",
          });
        }
        const settings = yield* serverSettings.getSettings.pipe(
          Effect.mapError(
            (cause) =>
              new ServerProviderUpdateError({
                provider: OPENCODE_PROVIDER,
                reason: cause instanceof Error ? cause.message : String(cause),
              }),
          ),
        );
        if (!isProviderEnabledForSettings(OPENCODE_PROVIDER, settings)) {
          return yield* new ServerProviderUpdateError({
            provider: OPENCODE_PROVIDER,
            reason: "Provider is disabled in Synara settings.",
          });
        }
        const capabilities = yield* getProviderMaintenanceCapabilities().pipe(
          Effect.mapError(
            (cause) =>
              new ServerProviderUpdateError({
                provider: OPENCODE_PROVIDER,
                reason: cause instanceof Error ? cause.message : String(cause),
              }),
          ),
        );
        const update = capabilities.update;
        if (!update) {
          return yield* new ServerProviderUpdateError({
            provider: OPENCODE_PROVIDER,
            reason: "This provider does not support one-click updates.",
          });
        }

        const startedAt = new Date().toISOString();
        yield* setProviderUpdateState({
          status: "running",
          startedAt,
          finishedAt: null,
          message: "Updating provider.",
          output: null,
        });

        const prepared = prepareWindowsSafeProcess(update.executable, update.args, {
          env: process.env,
        });
        const child = yield* spawner.spawn(
          ChildProcess.make(prepared.command, prepared.args, {
            shell: prepared.shell,
            env: process.env,
          }),
        );
        const [stdout, stderr, exitCode] = yield* Effect.all(
          [
            collectUint8StreamText({ stream: child.stdout, maxBytes: UPDATE_OUTPUT_MAX_BYTES }),
            collectUint8StreamText({ stream: child.stderr, maxBytes: UPDATE_OUTPUT_MAX_BYTES }),
            child.exitCode.pipe(Effect.map(Number)),
          ],
          { concurrency: "unbounded" },
        ).pipe(
          Effect.scoped,
          Effect.mapError(
            (cause) =>
              new ServerProviderUpdateError({
                provider: OPENCODE_PROVIDER,
                reason: cause instanceof Error ? cause.message : String(cause),
              }),
          ),
        );

        const finishedAt = new Date().toISOString();
        if (exitCode !== 0) {
          const providers = yield* setProviderUpdateState({
            status: "failed",
            startedAt,
            finishedAt,
            message: `Update command exited with code ${exitCode}.`,
            output: [stderr.text, stdout.text].filter(Boolean).join("\n\n").trim() || null,
          });
          return { providers: providers as ServerProviderUpdateResult["providers"] };
        }

        const providers = yield* refreshNow;
        yield* setProviderUpdateState({
          status: "succeeded",
          startedAt,
          finishedAt,
          message: "Provider updated.",
          output: [stderr.text, stdout.text].filter(Boolean).join("\n\n").trim() || null,
        });
        return { providers: providers as ServerProviderUpdateResult["providers"] };
      }).pipe(Effect.scoped, Effect.mapError(toUpdateError));
    };

    return {
      getStatuses: Ref.get(statusesRef).pipe(Effect.flatMap(projectStatusesForCurrentSettings)),
      refresh,
      updateProvider,
      get streamChanges() {
        return Stream.fromPubSub(changesPubSub);
      },
    } satisfies ProviderHealthShape;
  }),
);
