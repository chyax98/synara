#!/usr/bin/env bun
/**
 * Post-dry-run providers settings smoke: WS catalog RPCs + honest settings paths.
 */
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { WS_METHODS } from "@t3tools/contracts";
import type { ServerGetSettingsResult } from "@t3tools/contracts";
import { WsRpcGroup } from "../packages/contracts/src/rpc.ts";
import { Effect, Layer } from "effect";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import * as Socket from "effect/unstable/socket/Socket";

import {
  applyAppSettingsPatch,
  defaultAppSettings,
  resolveKnobSideEffects,
  serverSettingsPatchForAppSettingsPatch,
} from "../apps/web/src/lib/settingsUxMutations.ts";

const ROOT = join(import.meta.dirname, "..");
const port = Number(process.env.SMOKE_PORT ?? "58090");
const homeDir = process.env.SMOKE_HOME_DIR ?? join(ROOT, ".synara-opchamber-ref-smoke");
const baseUrl = `http://127.0.0.1:${port}`;
const wsUrl = `ws://127.0.0.1:${port}/ws`;

function waitForHealth(timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const response = await fetch(`${baseUrl}/health`);
        if (response.ok) {
          const payload = (await response.json()) as { startupReady?: boolean };
          if (payload.startupReady) {
            resolve();
            return;
          }
        }
      } catch {
        // still booting
      }
      if (Date.now() >= deadline) {
        reject(new Error(`Timed out waiting for ${baseUrl}/health`));
        return;
      }
      setTimeout(tick, 500);
    };
    void tick();
  });
}

async function callRpc<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const program = Effect.gen(function* () {
    const client = yield* RpcClient.make(WsRpcGroup);
    const call = (
      client as unknown as Record<
        string,
        (input: Record<string, unknown>) => Effect.Effect<unknown, unknown, never>
      >
    )[method];
    if (!call) {
      return yield* Effect.die(new Error(`Missing RPC method ${method}`));
    }
    return (yield* call(params)) as T;
  });

  const layer = RpcClient.layerProtocolSocket().pipe(
    Layer.provide(
      Layer.mergeAll(
        Socket.layerWebSocket(wsUrl).pipe(Layer.provide(Socket.layerWebSocketConstructorGlobal)),
        RpcSerialization.layerJson,
      ),
    ),
  );

  return Effect.runPromise(Effect.scoped(program.pipe(Effect.provide(layer))));
}

function observe(label: string, value: unknown) {
  console.log(`OBSERVATION: ${label}: ${JSON.stringify(value)}`);
}

async function main() {
  mkdirSync(homeDir, { recursive: true });
  const child = spawn(
    "bun",
    ["run", "src/index.ts", "--", "--home-dir", homeDir, "--port", String(port), "--no-browser"],
    {
      cwd: join(ROOT, "apps/server"),
      env: { ...process.env, T3CODE_NO_BROWSER: "1", T3CODE_AUTH_TOKEN: "" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.stdout?.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr?.on("data", (chunk) => process.stderr.write(chunk));

  const cleanup = () => {
    if (!child.killed) child.kill("SIGTERM");
    try {
      rmSync(homeDir, { recursive: true, force: true });
    } catch {
      // best effort
    }
  };

  try {
    await waitForHealth();
    console.log("OBSERVATION: server.startupReady=true");

    const overview = await callRpc<{
      availability?: { all?: Array<{ id: string }>; connected?: string[] };
    }>(WS_METHODS.opencodeCatalogOverview, { binaryPath: "opencode" });
    observe("catalogOverview.availability.all.count", overview.availability?.all?.length ?? 0);
    observe(
      "catalogOverview.availability.sampleIds",
      (overview.availability?.all ?? []).slice(0, 5).map((p) => p.id),
    );

    const configProviders = await callRpc<{
      providers?: Array<{ id: string; source?: string }>;
    }>(WS_METHODS.opencodeConfigProviders, { binaryPath: "opencode" });
    observe("configProviders.count", configProviders.providers?.length ?? 0);

    const base = defaultAppSettings();
    const reloadOff = applyAppSettingsPatch(base, { openCodeAutoReloadCatalog: false });
    const reloadOn = applyAppSettingsPatch(reloadOff, { openCodeAutoReloadCatalog: true });
    observe("knob.openCodeAutoReloadCatalog.off", reloadOff.openCodeAutoReloadCatalog);
    observe("knob.openCodeAutoReloadCatalog.restored", reloadOn.openCodeAutoReloadCatalog);
    observe(
      "knob.openCodeAutoReloadCatalog.serverPatchEmpty",
      serverSettingsPatchForAppSettingsPatch({ openCodeAutoReloadCatalog: false }),
    );

    const beforeSettings = await callRpc<ServerGetSettingsResult>(WS_METHODS.serverGetSettings, {});
    observe("server.enableAssistantStreaming.before", beforeSettings.enableAssistantStreaming);

    const nextStreaming = !beforeSettings.enableAssistantStreaming;
    const serverPatch = serverSettingsPatchForAppSettingsPatch({
      enableAssistantStreaming: nextStreaming,
    });
    observe("knob.enableAssistantStreaming.serverPatch", serverPatch);

    const afterUpdate = await callRpc<ServerGetSettingsResult>(
      WS_METHODS.serverUpdateSettings,
      serverPatch,
    );
    observe("server.enableAssistantStreaming.afterUpdate", afterUpdate.enableAssistantStreaming);

    const afterRead = await callRpc<ServerGetSettingsResult>(WS_METHODS.serverGetSettings, {});
    observe("server.enableAssistantStreaming.afterRead", afterRead.enableAssistantStreaming);
    observe(
      "knob.enableAssistantStreaming.deliveryMode",
      resolveKnobSideEffects({
        ...base,
        enableAssistantStreaming: afterRead.enableAssistantStreaming,
      }).assistantDeliveryMode,
    );

    if (afterRead.enableAssistantStreaming !== nextStreaming) {
      throw new Error(
        `enableAssistantStreaming round-trip failed: expected ${nextStreaming}, got ${afterRead.enableAssistantStreaming}`,
      );
    }

    await callRpc<ServerGetSettingsResult>(WS_METHODS.serverUpdateSettings, {
      enableAssistantStreaming: beforeSettings.enableAssistantStreaming,
    });

    console.log("OBSERVATION: providers-settings-smoke: PASS");
    cleanup();
    process.exit(0);
  } catch (error) {
    console.error("OBSERVATION: providers-settings-smoke: FAIL", error);
    cleanup();
    process.exit(1);
  }
}

await main();
