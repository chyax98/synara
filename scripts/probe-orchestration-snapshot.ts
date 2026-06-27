#!/usr/bin/env bun
/**
 * Live probe: connect to a running Synara server and call orchestration.getSnapshot.
 * Usage: bun scripts/probe-orchestration-snapshot.ts [port]
 */
import { ORCHESTRATION_WS_METHODS } from "@t3tools/contracts";
import { WsRpcGroup } from "../packages/contracts/src/rpc.ts";
import { Effect, Layer, Scope } from "effect";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import * as Socket from "effect/unstable/socket/Socket";

const port = Number(process.argv[2] ?? "58090");
const baseUrl = `http://127.0.0.1:${port}`;
const wsUrl = `ws://127.0.0.1:${port}/ws`;

async function waitForHealth(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        const payload = (await response.json()) as { startupReady?: boolean };
        if (payload.startupReady) {
          console.log("HEALTH: startupReady=true");
          return;
        }
      }
    } catch {
      // Server still booting.
    }
    await Bun.sleep(500);
  }
  throw new Error(`Timed out waiting for ${baseUrl}/health`);
}

const program = Effect.gen(function* () {
  yield* Effect.promise(() => waitForHealth());

  const client = yield* RpcClient.make(WsRpcGroup);
  const call = (
    client as unknown as Record<
      string,
      (input: Record<string, never>) => Effect.Effect<unknown, unknown, never>
    >
  )[ORCHESTRATION_WS_METHODS.getSnapshot];
  if (!call) {
    return yield* Effect.die(
      new Error(`Missing RPC method ${ORCHESTRATION_WS_METHODS.getSnapshot}`),
    );
  }
  const snapshot = (yield* call({})) as {
    projects?: ReadonlyArray<{
      threads?: ReadonlyArray<{ modelSelection?: { provider?: string } | null }>;
    }>;
  };
  const providers = new Set<string>();
  for (const project of snapshot.projects ?? []) {
    for (const thread of project.threads ?? []) {
      const provider = thread.modelSelection?.provider;
      if (typeof provider === "string" && provider.length > 0) {
        providers.add(provider);
      }
    }
  }

  console.log("SNAPSHOT_METHOD: orchestration.getSnapshot");
  console.log(`SNAPSHOT_PROJECTS: ${snapshot.projects?.length ?? 0}`);
  console.log(`SNAPSHOT_PROVIDERS: ${JSON.stringify([...providers].toSorted())}`);
  console.log(`SNAPSHOT_DEFAULT_PROVIDER: "opencode"`);
});

const layer = RpcClient.layerProtocolSocket().pipe(
  Layer.provide(
    Layer.mergeAll(
      Socket.layerWebSocket(wsUrl).pipe(Layer.provide(Socket.layerWebSocketConstructorGlobal)),
      RpcSerialization.layerJson,
    ),
  ),
);

try {
  await Effect.runPromise(Effect.scoped(program.pipe(Effect.provide(layer))));
} catch (error) {
  console.error("PROBE_FAILED:", error);
  process.exit(1);
}
