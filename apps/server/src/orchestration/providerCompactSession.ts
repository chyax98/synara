import { type OrchestrationEvent, type ThreadId, type TurnId } from "@t3tools/contracts";

export const COMPACT_SESSION_SET_COMMAND_TAG = "thread-session-set-after-compact";

export function resolveOrchestrationSessionAfterCompactEvent(input: {
  readonly compactTurnId: TurnId | undefined;
  readonly activeTurnId: TurnId | null;
}): {
  readonly status: "ready" | "running";
  readonly activeTurnId: TurnId | null;
} {
  if (input.compactTurnId === undefined) {
    return {
      status: "ready",
      activeTurnId: null,
    };
  }

  return {
    status: "running",
    activeTurnId: input.compactTurnId ?? input.activeTurnId,
  };
}

export function shouldDrainQueuedTurnsAfterCompactSessionSet(input: {
  readonly commandId: string | null;
  readonly status: string;
  readonly activeTurnId: TurnId | null;
}): boolean {
  if (!input.commandId) {
    return false;
  }
  return (
    input.commandId.includes(COMPACT_SESSION_SET_COMMAND_TAG) &&
    input.status === "ready" &&
    input.activeTurnId === null
  );
}

/** Gate used by ProviderCommandReactor's thread.session-set domain listener. */
export function resolveCompactSessionSetDrainThreadId(
  event: Pick<Extract<OrchestrationEvent, { type: "thread.session-set" }>, "commandId" | "payload">,
): ThreadId | null {
  const session = event.payload.session;
  if (
    !shouldDrainQueuedTurnsAfterCompactSessionSet({
      commandId: event.commandId ?? null,
      status: session.status,
      activeTurnId: session.activeTurnId,
    })
  ) {
    return null;
  }
  return event.payload.threadId;
}
