#!/usr/bin/env bun
/**
 * Live probe: create a project + thread, exercise queue dispatch on a ready
 * thread, and validate compact-drain gate logic. Full compact+queue E2E requires
 * a live provider; drain semantics are covered by integration tests.
 */
import {
  CommandId,
  DEFAULT_PROVIDER_INTERACTION_MODE,
  MessageId,
  ORCHESTRATION_WS_METHODS,
  ProjectId,
  ThreadId,
} from "@t3tools/contracts";
import { WsRpcGroup } from "../packages/contracts/src/rpc.ts";
import { Effect, Layer } from "effect";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import * as Socket from "effect/unstable/socket/Socket";

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  COMPACT_SESSION_SET_COMMAND_TAG,
  resolveCompactSessionSetDrainThreadId,
  shouldDrainQueuedTurnsAfterCompactSessionSet,
} from "../apps/server/src/orchestration/providerCompactSession.ts";

const port = Number(process.argv[2] ?? "58090");
const baseUrl = `http://127.0.0.1:${port}`;
const wsUrl = `ws://127.0.0.1:${port}/ws`;
const now = () => new Date().toISOString();

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

const layer = RpcClient.layerProtocolSocket().pipe(
  Layer.provide(
    Layer.mergeAll(
      Socket.layerWebSocket(wsUrl).pipe(Layer.provide(Socket.layerWebSocketConstructorGlobal)),
      RpcSerialization.layerJson,
    ),
  ),
);

const program = Effect.gen(function* () {
  yield* Effect.promise(() => waitForHealth());

  const client = yield* RpcClient.make(WsRpcGroup);
  const dispatch = (
    client as unknown as Record<
      string,
      (input: Record<string, unknown>) => Effect.Effect<unknown, unknown, never>
    >
  )[ORCHESTRATION_WS_METHODS.dispatchCommand];
  const getSnapshot = (
    client as unknown as Record<
      string,
      (input: Record<string, never>) => Effect.Effect<unknown, unknown, never>
    >
  )[ORCHESTRATION_WS_METHODS.getSnapshot];
  if (!dispatch || !getSnapshot) {
    return yield* Effect.die(new Error("Missing orchestration RPC methods."));
  }

  const stamp = Date.now();
  const projectId = ProjectId.makeUnsafe(`probe-project-${stamp}`);
  const threadId = ThreadId.makeUnsafe(`probe-thread-${stamp}`);
  const workspaceRoot = join(tmpdir(), `synara-compact-probe-${stamp}`);
  mkdirSync(workspaceRoot, { recursive: true });
  const createdAt = now();

  yield* dispatch({
    type: "project.create",
    commandId: CommandId.makeUnsafe(`cmd-${createdAt}-project`),
    projectId,
    title: "Compact Queue Probe",
    workspaceRoot,
    defaultModelSelection: {
      provider: "opencode",
      model: "gpt-5-codex",
    },
    createdAt,
  });

  yield* dispatch({
    type: "thread.create",
    commandId: CommandId.makeUnsafe(`cmd-${createdAt}-thread`),
    threadId,
    projectId,
    title: "Compact Queue Probe Thread",
    modelSelection: {
      provider: "opencode",
      model: "gpt-5-codex",
    },
    interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
    runtimeMode: "full-access",
    branch: null,
    worktreePath: null,
    createdAt,
  });

  const queued = (yield* dispatch({
    type: "thread.turn.start",
    commandId: CommandId.makeUnsafe(`cmd-${createdAt}-queue`),
    threadId,
    message: {
      messageId: MessageId.makeUnsafe(`msg-${createdAt}-queue`),
      role: "user",
      text: "queued follow-up on ready thread",
      attachments: [],
    },
    dispatchMode: "queue",
    runtimeMode: "full-access",
    interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
    createdAt,
  })) as { events?: Array<{ type: string }> };

  const queuedEventTypes = (queued.events ?? []).map((event) => event.type);
  console.log(`QUEUED_EVENT_TYPES: ${JSON.stringify(queuedEventTypes)}`);

  const drainGate = shouldDrainQueuedTurnsAfterCompactSessionSet({
    commandId: CommandId.makeUnsafe(`provider:evt:${COMPACT_SESSION_SET_COMMAND_TAG}:probe`),
    status: "ready",
    activeTurnId: null,
  });
  const drainThreadId = resolveCompactSessionSetDrainThreadId({
    commandId: CommandId.makeUnsafe(`provider:evt:${COMPACT_SESSION_SET_COMMAND_TAG}:probe`),
    payload: {
      threadId,
      session: {
        threadId,
        status: "ready",
        providerName: "opencode",
        runtimeMode: "full-access",
        activeTurnId: null,
        lastError: null,
        updatedAt: now(),
      },
    },
  });
  console.log(`COMPACT_DRAIN_GATE: ${drainGate}`);
  console.log(`COMPACT_DRAIN_THREAD: ${drainThreadId === threadId}`);

  const snapshot = (yield* getSnapshot({})) as {
    projects?: ReadonlyArray<{ id: string }>;
    threads?: ReadonlyArray<{ id: string; session?: { status?: string; activeTurnId?: unknown } }>;
  };
  const thread = snapshot.threads?.find((entry) => entry.id === threadId);
  console.log(`SNAPSHOT_PROJECTS: ${snapshot.projects?.length ?? 0}`);
  console.log(`SNAPSHOT_THREADS: ${snapshot.threads?.length ?? 0}`);
  console.log(`PROBE_THREAD_STATUS: ${thread?.session?.status ?? "missing"}`);
  console.log(`PROBE_THREAD_ACTIVE_TURN: ${thread?.session?.activeTurnId ?? "null"}`);
});

try {
  await Effect.runPromise(Effect.scoped(program.pipe(Effect.provide(layer))));
} catch (error) {
  console.error(error);
  process.exit(1);
}