import { EventId, ThreadId, TurnId } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";

import { shouldDrainQueuedTurnsAfterRuntimeEvent } from "./ProviderCommandReactor.ts";
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
