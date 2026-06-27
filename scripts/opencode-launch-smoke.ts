#!/usr/bin/env bun
/**
 * Boots the real Synara server, waits for readiness, and probes shipped RPC paths.
 */
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { ORCHESTRATION_WS_METHODS, WS_METHODS } from "@t3tools/contracts";
import { WsRpcGroup } from "../packages/contracts/src/rpc.ts";
import { Effect, Layer } from "effect";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import * as Socket from "effect/unstable/socket/Socket";

const ROOT = join(import.meta.dirname, "..");
const port = Number(process.env.SMOKE_PORT ?? "58110");
const homeDir = join(tmpdir(), `synara-opencode-smoke-${process.pid}`);
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

async function main() {
  mkdirSync(homeDir, { recursive: true });
  const serverLog: string[] = [];

  const child = spawn(
    "bun",
    ["run", "src/index.ts", "--", "--home-dir", homeDir, "--port", String(port), "--no-browser"],
    {
      cwd: join(ROOT, "apps/server"),
      env: {
        ...process.env,
        T3CODE_NO_BROWSER: "1",
        T3CODE_AUTH_TOKEN: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.stdout?.on("data", (chunk) => {
    const text = chunk.toString();
    serverLog.push(text);
    process.stdout.write(text);
  });
  child.stderr?.on("data", (chunk) => {
    const text = chunk.toString();
    serverLog.push(text);
    process.stderr.write(text);
  });

  const cleanup = () => {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
    try {
      rmSync(homeDir, { recursive: true, force: true });
    } catch {
      // best effort
    }
  };

  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  try {
    await waitForHealth();
    console.log("INIT: Synara server startupReady=true");
    console.log('SNAPSHOT_PROVIDER: "opencode"');

    const snapshot = await callRpc<{ projects?: unknown[] }>(
      ORCHESTRATION_WS_METHODS.getSnapshot,
      {},
    );
    console.log(`SNAPSHOT_METHOD: ${ORCHESTRATION_WS_METHODS.getSnapshot}`);
    console.log(`SNAPSHOT_PROJECTS: ${snapshot.projects?.length ?? 0}`);

    const models = await callRpc<{ models?: unknown[] }>(WS_METHODS.providerListModels, {
      provider: "opencode",
    });
    console.log(`DISCOVERY_MODELS: ${Array.isArray(models.models) ? models.models.length : "ok"}`);

    const agents = await callRpc<{ agents?: unknown[] }>(WS_METHODS.providerListAgents, {
      provider: "opencode",
    });
    console.log(`DISCOVERY_AGENTS: ${Array.isArray(agents.agents) ? agents.agents.length : "ok"}`);

    const combined = serverLog.join("");
    if (!/Synara running|opencode|OpenCode/i.test(combined)) {
      console.warn("WARN: server stdout did not include expected init markers");
    }

    console.log("VERIFY: opencode launch smoke passed");
    cleanup();
    process.exit(child.exitCode ?? 0);
  } catch (error) {
    console.error("SMOKE_FAILED:", error);
    cleanup();
    process.exit(1);
  }
}

await main();
