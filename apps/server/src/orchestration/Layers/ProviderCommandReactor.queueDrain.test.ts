import { EventId, ThreadId, TurnId } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";

import { shouldDrainQueuedTurnsAfterRuntimeEvent } from "./ProviderCommandReactor.ts";

describe("shouldDrainQueuedTurnsAfterRuntimeEvent", () => {
  it("drains after terminal turn events", () => {
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

  it("drains after idle compaction", () => {
    expect(
      shouldDrainQueuedTurnsAfterRuntimeEvent({
        type: "thread.state.changed",
        eventId: EventId.makeUnsafe("evt-3"),
        provider: "opencode",
        createdAt: "2026-01-01T00:00:00.000Z",
        threadId: ThreadId.makeUnsafe("thread-1"),
        payload: { state: "compacted", detail: { source: "opencode" } },
      }),
    ).toBe(true);
  });

  it("does not drain when compaction still belongs to an active turn", () => {
    expect(
      shouldDrainQueuedTurnsAfterRuntimeEvent({
        type: "thread.state.changed",
        eventId: EventId.makeUnsafe("evt-4"),
        provider: "opencode",
        createdAt: "2026-01-01T00:00:00.000Z",
        threadId: ThreadId.makeUnsafe("thread-1"),
        turnId: TurnId.makeUnsafe("turn-1"),
        payload: { state: "compacted", detail: { source: "opencode" } },
      }),
    ).toBe(false);
  });
});
