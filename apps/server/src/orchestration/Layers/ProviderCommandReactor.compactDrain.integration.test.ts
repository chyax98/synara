import {
  CommandId,
  DEFAULT_PROVIDER_INTERACTION_MODE,
  MessageId,
  type OrchestrationEvent,
  ProjectId,
  ThreadId,
  TurnId,
} from "@t3tools/contracts";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Exit, Layer, ManagedRuntime, Queue, Scope, Stream } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ServerConfig } from "../../config.ts";
import {
  CheckpointStore,
  type CheckpointStoreShape,
} from "../../checkpointing/Services/CheckpointStore.ts";
import { GitCore, type GitCoreShape } from "../../git/Services/GitCore.ts";
import { TextGeneration } from "../../git/Services/TextGeneration.ts";
import { OrchestrationCommandReceiptRepositoryLive } from "../../persistence/Layers/OrchestrationCommandReceipts.ts";
import { OrchestrationEventStoreLive } from "../../persistence/Layers/OrchestrationEventStore.ts";
import { SqlitePersistenceMemory } from "../../persistence/Layers/Sqlite.ts";
import {
  ProviderService,
  type ProviderServiceShape,
} from "../../provider/Services/ProviderService.ts";
import { ServerSettingsService } from "../../serverSettings.ts";
import { COMPACT_SESSION_SET_COMMAND_TAG } from "../providerCompactSession.ts";
import { OrchestrationEngineService } from "../Services/OrchestrationEngine.ts";
import { ProviderCommandReactor } from "../Services/ProviderCommandReactor.ts";
import { OrchestrationEngineLive } from "./OrchestrationEngine.ts";
import { OrchestrationProjectionPipelineLive } from "./ProjectionPipeline.ts";
import { OrchestrationProjectionSnapshotQueryLive } from "./ProjectionSnapshotQuery.ts";
import {
  ProviderCommandReactorLive,
  runCompactSessionSetDrainForDomainEvent,
} from "./ProviderCommandReactor.ts";

const unsupported = () => Effect.die(new Error("Unsupported ProviderCommandReactor test call"));

const THREAD_ID = ThreadId.makeUnsafe("thread-compact-drain");
const PROJECT_ID = ProjectId.makeUnsafe("project-compact-drain");
const NOW = "2026-06-28T00:00:00.000Z";

function makeProviderServiceMock(): ProviderServiceShape {
  return {
    streamEvents: Stream.empty,
    startSession: () => unsupported(),
    sendTurn: () => unsupported(),
    steerTurn: () => unsupported(),
    startReview: () => unsupported(),
    interruptTurn: () => Effect.void,
    respondToRequest: () => unsupported(),
    respondToUserInput: () => unsupported(),
    stopSession: () => Effect.void,
    listSessions: () => Effect.succeed([]),
    getCapabilities: () => unsupported(),
    rollbackConversation: () => unsupported(),
    compactThread: () => Effect.void,
  };
}

async function createCompactDrainSystem() {
  const ServerConfigLayer = ServerConfig.layerTest(process.cwd(), {
    prefix: "t3-compact-drain-test-",
  });
  const orchestrationLayer = OrchestrationEngineLive.pipe(
    Layer.provideMerge(OrchestrationProjectionPipelineLive),
    Layer.provideMerge(OrchestrationProjectionSnapshotQueryLive),
    Layer.provideMerge(OrchestrationEventStoreLive),
    Layer.provideMerge(OrchestrationCommandReceiptRepositoryLive),
    Layer.provideMerge(SqlitePersistenceMemory),
    Layer.provideMerge(ServerConfigLayer),
    Layer.provideMerge(NodeServices.layer),
  );
  const layer = ProviderCommandReactorLive.pipe(
    Layer.provideMerge(orchestrationLayer),
    Layer.provideMerge(Layer.succeed(ProviderService, makeProviderServiceMock())),
    Layer.provideMerge(
      Layer.succeed(GitCore, {
        execute: () => unsupported(),
      } as unknown as GitCoreShape),
    ),
    Layer.provideMerge(
      Layer.succeed(CheckpointStore, {
        isGitRepository: () => Effect.succeed(false),
        captureCheckpoint: () => unsupported(),
        copyCheckpointRef: () => unsupported(),
        restoreCheckpoint: () => unsupported(),
        deleteCheckpointRefs: () => unsupported(),
        listCheckpointRefs: () => Effect.succeed([]),
      } as unknown as CheckpointStoreShape),
    ),
    Layer.provideMerge(
      Layer.succeed(TextGeneration, {
        generateCommitMessage: () => unsupported(),
        generatePrContent: () => unsupported(),
        generateDiffSummary: () => unsupported(),
        generateBranchName: () => unsupported(),
        generateThreadTitle: () => unsupported(),
        generateThreadRecap: () => unsupported(),
        generateAutomationIntent: () => unsupported(),
        evaluateAutomationCompletion: () => unsupported(),
      }),
    ),
    Layer.provideMerge(ServerSettingsService.layerTest()),
  );
  const runtime = ManagedRuntime.make(layer);
  const engine = await runtime.runPromise(Effect.service(OrchestrationEngineService));
  const reactor = await runtime.runPromise(Effect.service(ProviderCommandReactor));
  return {
    engine,
    reactor,
    run: <A, E>(effect: Effect.Effect<A, E>) => runtime.runPromise(effect),
    dispose: () => runtime.dispose(),
  };
}

describe("runCompactSessionSetDrainForDomainEvent", () => {
  it("invokes drain only for compact-ready thread.session-set domain events", async () => {
    const drain = vi.fn((_threadId: ThreadId) => Effect.void);
    const compactReadyEvent = {
      type: "thread.session-set",
      commandId: CommandId.makeUnsafe(`provider:evt:${COMPACT_SESSION_SET_COMMAND_TAG}:listener`),
      payload: {
        threadId: THREAD_ID,
        session: {
          threadId: THREAD_ID,
          status: "ready",
          providerName: "opencode",
          runtimeMode: "full-access",
          activeTurnId: null,
          lastError: null,
          updatedAt: NOW,
        },
      },
    } as Extract<OrchestrationEvent, { type: "thread.session-set" }>;

    await Effect.runPromise(
      runCompactSessionSetDrainForDomainEvent(compactReadyEvent, (threadId) => {
        drain(threadId);
        return Effect.void;
      }),
    );
    expect(drain).toHaveBeenCalledWith(THREAD_ID);

    drain.mockClear();
    await Effect.runPromise(
      runCompactSessionSetDrainForDomainEvent(
        {
          type: "thread.meta-updated",
          payload: { threadId: THREAD_ID, title: "noop" },
        } as OrchestrationEvent,
        (threadId) => {
          drain(threadId);
          return Effect.void;
        },
      ),
    );
    expect(drain).not.toHaveBeenCalled();
  });
});

describe("ProviderCommandReactor compact drain listener", () => {
  let system: Awaited<ReturnType<typeof createCompactDrainSystem>> | null = null;

  afterEach(async () => {
    if (system) {
      await system.dispose();
    }
    system = null;
  });

  it("drains queued turns when streamDomainEvents emits compact-ready thread.session-set", async () => {
    system = await createCompactDrainSystem();
    const { engine, reactor } = system;
    const observedEventTypes: string[] = [];

    await system.run(
      Effect.gen(function* () {
        const scope = yield* Scope.make("sequential");
        const eventQueue = yield* Queue.unbounded<OrchestrationEvent>();
        yield* reactor.start.pipe(Scope.provide(scope));
        yield* Effect.forkScoped(
          Stream.runForEach(engine.streamDomainEvents, (event) =>
            Effect.gen(function* () {
              observedEventTypes.push(event.type);
              yield* Queue.offer(eventQueue, event);
            }),
          ),
        );
        yield* Effect.sleep("20 millis");

        yield* engine.dispatch({
          type: "project.create",
          commandId: CommandId.makeUnsafe("cmd-project-compact-drain"),
          projectId: PROJECT_ID,
          title: "Compact Drain Project",
          workspaceRoot: "/tmp/compact-drain-project",
          defaultModelSelection: { provider: "opencode", model: "gpt-5-codex" },
          createdAt: NOW,
        });
        yield* engine.dispatch({
          type: "thread.create",
          commandId: CommandId.makeUnsafe("cmd-thread-compact-drain"),
          threadId: THREAD_ID,
          projectId: PROJECT_ID,
          title: "Compact Drain Thread",
          modelSelection: { provider: "opencode", model: "gpt-5-codex" },
          interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
          runtimeMode: "full-access",
          branch: null,
          worktreePath: null,
          createdAt: NOW,
        });
        yield* engine.dispatch({
          type: "thread.session.set",
          commandId: CommandId.makeUnsafe("cmd-session-running"),
          threadId: THREAD_ID,
          session: {
            threadId: THREAD_ID,
            status: "running",
            providerName: "opencode",
            runtimeMode: "full-access",
            activeTurnId: TurnId.makeUnsafe("turn-live"),
            lastError: null,
            updatedAt: NOW,
          },
          createdAt: NOW,
        });

        yield* engine.dispatch({
          type: "thread.turn.start",
          commandId: CommandId.makeUnsafe("cmd-queue-during-running"),
          threadId: THREAD_ID,
          message: {
            messageId: MessageId.makeUnsafe("msg-queued-during-running"),
            role: "user",
            text: "queued during running turn",
            attachments: [],
          },
          dispatchMode: "queue",
          runtimeMode: "full-access",
          interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
          createdAt: NOW,
        });

        yield* reactor.drain;
        yield* Effect.sleep("30 millis");

        yield* engine.dispatch({
          type: "thread.session.set",
          commandId: CommandId.makeUnsafe(`provider:evt:${COMPACT_SESSION_SET_COMMAND_TAG}:drain`),
          threadId: THREAD_ID,
          session: {
            threadId: THREAD_ID,
            status: "ready",
            providerName: "opencode",
            runtimeMode: "full-access",
            activeTurnId: null,
            lastError: null,
            updatedAt: NOW,
          },
          createdAt: NOW,
        });

        const deadline = Date.now() + 2_000;
        while (!observedEventTypes.includes("thread.turn-start-requested")) {
          if (Date.now() > deadline) {
            throw new Error(
              `Timed out waiting for queued drain dispatch; saw ${observedEventTypes.join(", ")}`,
            );
          }
          yield* Effect.sleep("10 millis");
        }

        yield* Scope.close(scope, Exit.void);
      }).pipe(Effect.scoped),
    );

    expect(observedEventTypes).toEqual(
      expect.arrayContaining([
        "thread.turn-queued",
        "thread.session-set",
        "thread.turn-start-requested",
      ]),
    );
  });
});
