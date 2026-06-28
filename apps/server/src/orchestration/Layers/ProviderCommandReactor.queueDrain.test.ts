import { CommandId, EventId, ThreadId, TurnId } from "@t3tools/contracts";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  runCompactSessionSetDrainForDomainEvent,
  shouldDrainQueuedTurnsAfterRuntimeEvent,
} from "./ProviderCommandReactor.ts";
import { shouldDrainQueuedTurnsAfterCompactSessionSet } from "../providerCompactSession.ts";

describe("shouldDrainQueuedTurnsAfterRuntimeEvent", () => {
  it("drains after terminal turn events only", () => {
    expect(
      shouldDrainQueuedTurnsAfterRuntimeEvent({
        type: "turn.completed",
        eventId: EventId.makeUnsafe("evt-1"),
        provider: "opencode",
        createdAt: "2026-01-01T00:00:00.000Z",
        threadId: ThreadId.makeUnsafe("thread-1"),
        turnId: TurnId.makeUnsafe("turn-1"),
        payload: { state: "completed" },
      }),
    ).toBe(true);
    expect(
      shouldDrainQueuedTurnsAfterRuntimeEvent({
        type: "turn.aborted",
        eventId: EventId.makeUnsafe("evt-2"),
        provider: "opencode",
        createdAt: "2026-01-01T00:00:00.000Z",
        threadId: ThreadId.makeUnsafe("thread-1"),
        turnId: TurnId.makeUnsafe("turn-1"),
        payload: { reason: "interrupted" },
      }),
    ).toBe(true);
  });
});

describe("runCompactSessionSetDrainForDomainEvent", () => {
  it("routes only compact-ready thread.session-set events to the drain callback", async () => {
    const drainThreadIds: ThreadId[] = [];
    await Effect.runPromise(
      runCompactSessionSetDrainForDomainEvent(
        {
          type: "thread.session-set",
          commandId: CommandId.makeUnsafe("provider:evt:thread-session-set-after-compact:route"),
          payload: {
            threadId: ThreadId.makeUnsafe("thread-route"),
            session: {
              threadId: ThreadId.makeUnsafe("thread-route"),
              status: "ready",
              providerName: "opencode",
              runtimeMode: "full-access",
              activeTurnId: null,
              lastError: null,
              updatedAt: "2026-06-28T00:00:00.000Z",
            },
          },
        } as Extract<
          import("@t3tools/contracts").OrchestrationEvent,
          { type: "thread.session-set" }
        >,
        (threadId) =>
          Effect.sync(() => {
            drainThreadIds.push(threadId);
          }),
      ),
    );
    expect(drainThreadIds).toEqual([ThreadId.makeUnsafe("thread-route")]);
  });
});

describe("compact queue drain ordering", () => {
  it("waits for compact session-set instead of raw compacted runtime events", () => {
    expect(
      shouldDrainQueuedTurnsAfterCompactSessionSet({
        commandId: "provider:evt-3:thread-session-set-after-compact:abc",
        status: "ready",
        activeTurnId: null,
      }),
    ).toBe(true);
  });
});
