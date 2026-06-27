import { MessageId, type ThreadImportedMessage, type ThreadId } from "@t3tools/contracts";

function readOpenCodeSessionMessageText(parts: ReadonlyArray<unknown>): string {
  return parts
    .flatMap((part) => {
      if (!part || typeof part !== "object") return [];
      const candidate = part as {
        readonly type?: unknown;
        readonly text?: unknown;
      };
      return candidate.type === "text" && typeof candidate.text === "string"
        ? [candidate.text]
        : [];
    })
    .join("\n\n")
    .trim();
}

export function mapOpenCodeSnapshotMessages(input: {
  readonly importedAt: string;
  readonly threadId: ThreadId;
  readonly turns: ReadonlyArray<{
    readonly items: ReadonlyArray<unknown>;
  }>;
}): ReadonlyArray<ThreadImportedMessage> {
  return input.turns.flatMap((turn, turnIndex) =>
    turn.items.flatMap((item, itemIndex) => {
      if (!item || typeof item !== "object") return [];

      const candidate = item as {
        readonly info?: {
          readonly id?: unknown;
          readonly role?: unknown;
        };
        readonly parts?: ReadonlyArray<unknown>;
      };
      const role =
        candidate.info?.role === "user"
          ? "user"
          : candidate.info?.role === "assistant"
            ? "assistant"
            : null;
      if (role === null) return [];

      const text = readOpenCodeSessionMessageText(candidate.parts ?? []);
      if (text.length === 0) return [];

      const sourceId =
        typeof candidate.info?.id === "string" && candidate.info.id.length > 0
          ? candidate.info.id
          : `${turnIndex}:${itemIndex}`;

      return [
        {
          messageId: MessageId.makeUnsafe(
            `import:${String(input.threadId)}:opencode:${turnIndex}:${itemIndex}:${sourceId}`,
          ),
          role,
          text,
          createdAt: input.importedAt,
          updatedAt: input.importedAt,
        },
      ];
    }),
  );
}