import {
  CommandId,
  DEFAULT_PROVIDER_INTERACTION_MODE,
  EventId,
  MessageId,
  type OrchestrationEvent,
  ProjectId,
  ThreadId,
  TurnId,
} from "@t3tools/contracts";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { decideOrchestrationCommand } from "./decider.ts";
import { createEmptyReadModel, projectEvent } from "./projector.ts";

const PROJECT_ID = ProjectId.makeUnsafe("project-1");
const THREAD_ID = ThreadId.makeUnsafe("thread-1");
const NOW = "2026-06-28T00:00:00.000Z";

const asEventId = (value: string) => EventId.makeUnsafe(value);

type DecidedOrchestrationEvent = Omit<OrchestrationEvent, "sequence">;

function asDecidedEvents(
  result: DecidedOrchestrationEvent | ReadonlyArray<DecidedOrchestrationEvent>,
) {
  if (Array.isArray(result)) {
    return [...result];
  }
  return [result];
}

async function createThreadReadModel(input: {
  status: "ready" | "running";
  activeTurnId: TurnId | null;
}) {
  const withProject = await Effect.runPromise(
    projectEvent(createEmptyReadModel(NOW), {
      sequence: 1,
      eventId: asEventId("evt-project-create"),
      aggregateKind: "project",
      aggregateId: PROJECT_ID,
      type: "project.created",
      occurredAt: NOW,
      commandId: CommandId.makeUnsafe("cmd-project-create"),
      causationEventId: null,
      correlationId: CommandId.makeUnsafe("cmd-project-create"),
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
      eventId: asEventId("evt-thread-create"),
      aggregateKind: "thread",
      aggregateId: THREAD_ID,
      type: "thread.created",
      occurredAt: NOW,
      commandId: CommandId.makeUnsafe("cmd-thread-create"),
      causationEventId: null,
      correlationId: CommandId.makeUnsafe("cmd-thread-create"),
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

  return Effect.runPromise(
    projectEvent(withThread, {
      sequence: 3,
      eventId: asEventId("evt-session-set"),
      aggregateKind: "thread",
      aggregateId: THREAD_ID,
      type: "thread.session-set",
      occurredAt: NOW,
      commandId: CommandId.makeUnsafe("cmd-session-set"),
      causationEventId: null,
      correlationId: CommandId.makeUnsafe("cmd-session-set"),
      metadata: {},
      payload: {
        threadId: THREAD_ID,
        session: {
          threadId: THREAD_ID,
          status: input.status,
          providerName: "opencode",
          runtimeMode: "full-access",
          activeTurnId: input.activeTurnId,
          lastError: null,
          updatedAt: NOW,
        },
      },
    }),
  );
}

describe("decider queue interop", () => {
  it("queues follow-ups while a provider turn is live", async () => {
    const readModel = await createThreadReadModel({
      status: "running",
      activeTurnId: TurnId.makeUnsafe("turn-live"),
    });

    const events = asDecidedEvents(
      await Effect.runPromise(
        decideOrchestrationCommand({
          readModel,
          command: {
            type: "thread.turn.start",
            commandId: CommandId.makeUnsafe("cmd-send-queued"),
            threadId: THREAD_ID,
            message: {
              messageId: MessageId.makeUnsafe("msg-queued"),
              role: "user",
              text: "queued follow-up",
              attachments: [],
            },
            dispatchMode: "queue",
            runtimeMode: "full-access",
            interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
            createdAt: NOW,
          },
        }),
      ),
    );

    expect(events.map((event) => event.type)).toEqual([
      "thread.message-sent",
      "thread.turn-queued",
    ]);
  });

  it("starts immediately once compaction leaves the session ready", async () => {
    const readModel = await createThreadReadModel({
      status: "ready",
      activeTurnId: null,
    });

    const events = asDecidedEvents(
      await Effect.runPromise(
        decideOrchestrationCommand({
          readModel,
          command: {
            type: "thread.turn.start",
            commandId: CommandId.makeUnsafe("cmd-send-ready"),
            threadId: THREAD_ID,
            message: {
              messageId: MessageId.makeUnsafe("msg-ready"),
              role: "user",
              text: "send after compact",
              attachments: [],
            },
            dispatchMode: "queue",
            runtimeMode: "full-access",
            interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
            createdAt: NOW,
          },
        }),
      ),
    );

    expect(events.map((event) => event.type)).toEqual([
      "thread.message-sent",
      "thread.turn-start-requested",
    ]);
  });

  it("requests an interrupt when steer is used against a live turn", async () => {
    const activeTurnId = TurnId.makeUnsafe("turn-live");
    const readModel = await createThreadReadModel({
      status: "running",
      activeTurnId,
    });

    const events = asDecidedEvents(
      await Effect.runPromise(
        decideOrchestrationCommand({
          readModel,
          command: {
            type: "thread.turn.start",
            commandId: CommandId.makeUnsafe("cmd-send-steer"),
            threadId: THREAD_ID,
            message: {
              messageId: MessageId.makeUnsafe("msg-steer"),
              role: "user",
              text: "steer this turn",
              attachments: [],
            },
            dispatchMode: "steer",
            runtimeMode: "full-access",
            interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
            createdAt: NOW,
          },
        }),
      ),
    );

    expect(events.map((event) => event.type)).toEqual([
      "thread.message-sent",
      "thread.turn-queued",
      "thread.turn-interrupt-requested",
    ]);
    const interrupt = events.find((event) => event.type === "thread.turn-interrupt-requested");
    expect(interrupt?.type).toBe("thread.turn-interrupt-requested");
    if (interrupt?.type === "thread.turn-interrupt-requested") {
      expect(interrupt.payload.turnId).toBe(activeTurnId);
    }
  });
});
