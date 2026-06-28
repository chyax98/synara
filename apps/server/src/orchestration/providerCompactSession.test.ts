import { TurnId } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";

import {
  COMPACT_SESSION_SET_COMMAND_TAG,
  resolveOrchestrationSessionAfterCompactEvent,
  shouldDrainQueuedTurnsAfterCompactSessionSet,
} from "./providerCompactSession.ts";

describe("resolveOrchestrationSessionAfterCompactEvent", () => {
  it("clears the active turn when compaction finishes while idle", () => {
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

  it("keeps the active turn when compaction happens during a live turn", () => {
    const activeTurnId = TurnId.makeUnsafe("turn-live");
    expect(
      resolveOrchestrationSessionAfterCompactEvent({
        compactTurnId: activeTurnId,
        activeTurnId,
      }),
    ).toEqual({
      status: "running",
      activeTurnId,
    });
  });
});

describe("shouldDrainQueuedTurnsAfterCompactSessionSet", () => {
  it("drains only after compact session-set reaches ready with no active turn", () => {
    expect(
      shouldDrainQueuedTurnsAfterCompactSessionSet({
        commandId: `provider:evt-1:${COMPACT_SESSION_SET_COMMAND_TAG}:abc`,
        status: "ready",
        activeTurnId: null,
      }),
    ).toBe(true);
    expect(
      shouldDrainQueuedTurnsAfterCompactSessionSet({
        commandId: "provider:evt-1:thread-session-set:abc",
        status: "ready",
        activeTurnId: null,
      }),
    ).toBe(false);
    expect(
      shouldDrainQueuedTurnsAfterCompactSessionSet({
        commandId: `provider:evt-1:${COMPACT_SESSION_SET_COMMAND_TAG}:abc`,
        status: "running",
        activeTurnId: TurnId.makeUnsafe("turn-live"),
      }),
    ).toBe(false);
  });
});
