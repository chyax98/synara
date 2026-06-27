// FILE: threadImportedMessages.ts
// Purpose: Builds imported transcript payloads for fork/sidechat flows.
// Layer: Web thread utilities

import { MessageId, type ThreadImportedMessage } from "@t3tools/contracts";
import { type Thread } from "../types";
import { stripEmbeddedAssistantSelections } from "./assistantSelections";
import { randomUUID } from "./utils";

function isImportableThreadMessage(
  message: Thread["messages"][number],
): message is Thread["messages"][number] & {
  role: "user" | "assistant";
} {
  return (message.role === "user" || message.role === "assistant") && message.streaming === false;
}

export function buildThreadImportedMessages(
  thread: Pick<Thread, "messages">,
): ReadonlyArray<ThreadImportedMessage> {
  return thread.messages.filter(isImportableThreadMessage).map((message) => {
    const importedText =
      message.role === "user" ? stripEmbeddedAssistantSelections(message.text) : message.text;
    return {
      messageId: MessageId.makeUnsafe(randomUUID()),
      role: message.role,
      text: importedText,
      createdAt: message.createdAt,
      updatedAt: message.createdAt,
    };
  });
}