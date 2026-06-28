import {
  CommandId,
  DEFAULT_PROVIDER_INTERACTION_MODE,
  EventId,
  MessageId,
  ProjectId,
  ThreadId,
  TurnId,
} from "@t3tools/contracts";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { decideOrchestrationCommand } from "./decider.ts";
import {
  COMPACT_SESSION_SET_COMMAND_TAG,
  resolveCompactSessionSetDrainThreadId,
  resolveOrchestrationSessionAfterCompactEvent,
} from "./providerCompactSession.ts";
import { createEmptyReadModel, projectEvent } from "./projector.ts";

const THREAD_ID = ThreadId.makeUnsafe("thread-compact-queue");
const PROJECT_ID = ProjectId.makeUnsafe("project-1");
const NOW = "2026-06-28T00:00:00.000Z";

describe("compact + queue scenario", () => {
  it("resolves drain target only after projected compact session-set", () => {
    const drainThreadId = resolveCompactSessionSetDrainThreadId({
      commandId: CommandId.makeUnsafe(`provider:evt:${COMPACT_SESSION_SET_COMMAND_TAG}:abc`),
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
    });

    expect(drainThreadId).toBe(THREAD_ID);
    expect(
      resolveOrchestrationSessionAfterCompactEvent({
        compactTurnId: undefined,
        activeTurnId: TurnId.makeUnsafe("stale-turn"),
      }),
    ).toEqual({
      status: "ready",
      activeTurnId: null,
    });
  });

  it("keeps steer interrupt available while a turn is live, then allows dispatch after compact ready", async () => {
    const withProject = await Effect.runPromise(
      projectEvent(createEmptyReadModel(NOW), {
        sequence: 1,
        eventId: EventId.makeUnsafe("evt-project"),
        aggregateKind: "project",
        aggregateId: PROJECT_ID,
        type: "project.created",
        occurredAt: NOW,
        commandId: CommandId.makeUnsafe("cmd-project"),
        causationEventId: null,
        correlationId: CommandId.makeUnsafe("cmd-project"),
        metadata: {},
        payload: {
          projectId: PROJECT_ID,
          title: "Project",
          workspaceRoot: "/tmp/project",
          defaultModelSelection: null,
          scripts: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
      }),
    );
    const withThread = await Effect.runPromise(
      projectEvent(withProject, {
        sequence: 2,
        eventId: EventId.makeUnsafe("evt-thread"),
        aggregateKind: "thread",
        aggregateId: THREAD_ID,
        type: "thread.created",
        occurredAt: NOW,
        commandId: CommandId.makeUnsafe("cmd-thread"),
        causationEventId: null,
        correlationId: CommandId.makeUnsafe("cmd-thread"),
        metadata: {},
        payload: {
          threadId: THREAD_ID,
          projectId: PROJECT_ID,
          title: "Thread",
          modelSelection: { provider: "opencode", model: "gpt-5-codex" },
          interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
          runtimeMode: "full-access",
          envMode: "local",
          branch: null,
          worktreePath: null,
          associatedWorktreePath: null,
          associatedWorktreeBranch: null,
          associatedWorktreeRef: null,
          parentThreadId: null,
          subagentAgentId: null,
          subagentNickname: null,
          subagentRole: null,
          forkSourceThreadId: null,
          sidechatSourceThreadId: null,
          createdAt: NOW,
          updatedAt: NOW,
        },
      }),
    );
    const runningReadModel = await Effect.runPromise(
      projectEvent(withThread, {
        sequence: 3,
        eventId: EventId.makeUnsafe("evt-running"),
        aggregateKind: "thread",
        aggregateId: THREAD_ID,
        type: "thread.session-set",
        occurredAt: NOW,
        commandId: CommandId.makeUnsafe("cmd-running"),
        causationEventId: null,
        correlationId: CommandId.makeUnsafe("cmd-running"),
        metadata: {},
        payload: {
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
        },
      }),
    );

    const steerWhileRunning = await Effect.runPromise(
      decideOrchestrationCommand({
        readModel: runningReadModel,
        command: {
          type: "thread.turn.start",
          commandId: CommandId.makeUnsafe("cmd-steer-compacting"),
          threadId: THREAD_ID,
          message: {
            messageId: MessageId.makeUnsafe("msg-steer-compacting"),
            role: "user",
            text: "steer during compaction",
            attachments: [],
          },
          dispatchMode: "steer",
          runtimeMode: "full-access",
          interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
          createdAt: NOW,
        },
      }),
    );
    const steerEvents = Array.isArray(steerWhileRunning) ? steerWhileRunning : [steerWhileRunning];
    expect(steerEvents.map((event) => event.type)).toEqual([
      "thread.message-sent",
      "thread.turn-queued",
      "thread.turn-interrupt-requested",
    ]);

    const readyReadModel = await Effect.runPromise(
      projectEvent(runningReadModel, {
        sequence: 4,
        eventId: EventId.makeUnsafe("evt-compact-ready"),
        aggregateKind: "thread",
        aggregateId: THREAD_ID,
        type: "thread.session-set",
        occurredAt: NOW,
        commandId: CommandId.makeUnsafe(`provider:evt:${COMPACT_SESSION_SET_COMMAND_TAG}:done`),
        causationEventId: null,
        correlationId: CommandId.makeUnsafe(`provider:evt:${COMPACT_SESSION_SET_COMMAND_TAG}:done`),
        metadata: {},
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
      }),
    );

    const afterCompact = await Effect.runPromise(
      decideOrchestrationCommand({
        readModel: readyReadModel,
        command: {
          type: "thread.turn.start",
          commandId: CommandId.makeUnsafe("cmd-after-compact"),
          threadId: THREAD_ID,
          message: {
            messageId: MessageId.makeUnsafe("msg-after-compact"),
            role: "user",
            text: "dispatch after compact",
            attachments: [],
          },
          dispatchMode: "queue",
          runtimeMode: "full-access",
          interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
          createdAt: NOW,
        },
      }),
    );
    const afterCompactEvents = Array.isArray(afterCompact) ? afterCompact : [afterCompact];
    expect(afterCompactEvents.map((event) => event.type)).toEqual([
      "thread.message-sent",
      "thread.turn-start-requested",
    ]);
    expect(readyReadModel.threads[0]?.session?.status).toBe("ready");
    expect(readyReadModel.threads[0]?.session?.activeTurnId).toBeNull();
    expect(
      resolveCompactSessionSetDrainThreadId({
        commandId: CommandId.makeUnsafe(`provider:evt:${COMPACT_SESSION_SET_COMMAND_TAG}:done`),
        payload: {
          threadId: THREAD_ID,
          session: readyReadModel.threads[0]!.session!,
        },
      }),
    ).toBe(THREAD_ID);
  });
});
