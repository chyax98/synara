import type { ChatMessage } from "./types";
import { stripEmbeddedAssistantSelections } from "./lib/assistantSelections";

export interface BootstrapInputResult {
  text: string;
  includedCount: number;
  omittedCount: number;
  truncated: boolean;
}

const BOOTSTRAP_PREAMBLE =
  "请基于下方的历史上下文继续本次对话。最后一部分是需要你现在回答的最近一条用户请求。";
const TRANSCRIPT_HEADER = "历史上下文：";
const LATEST_PROMPT_HEADER = "最近的用户请求（请回答这条）：";
const OMITTED_SUMMARY = (count: number) => `[为控制在输入上限内，已省略 ${count} 条更早的消息。]`;

function messageRoleLabel(message: ChatMessage): "USER" | "ASSISTANT" {
  return message.role === "assistant" ? "ASSISTANT" : "USER";
}

function attachmentSummary(message: ChatMessage): string | null {
  const imageAttachments = message.attachments?.filter((attachment) => attachment.type === "image");
  const fileAttachments = message.attachments?.filter((attachment) => attachment.type === "file");
  const assistantSelections = message.attachments?.filter(
    (attachment) => attachment.type === "assistant-selection",
  );
  const summaries: string[] = [];

  const count = imageAttachments?.length ?? 0;
  if (count > 0) {
    const names = imageAttachments?.slice(0, 3).map((image) => image.name) ?? [];
    const namesSummary = names.join("、");
    const extraCount = count - names.length;
    const extraSummary = extraCount > 0 ? `（及其他 ${extraCount} 张）` : "";
    summaries.push(`[已附带 ${count} 张图片：${namesSummary}${extraSummary}]`);
  }

  const fileCount = fileAttachments?.length ?? 0;
  if (fileCount > 0) {
    const names = fileAttachments?.slice(0, 3).map((file) => file.name) ?? [];
    const namesSummary = names.join("、");
    const extraCount = fileCount - names.length;
    const extraSummary = extraCount > 0 ? `（及其他 ${extraCount} 个）` : "";
    summaries.push(`[已附带 ${fileCount} 个文件：${namesSummary}${extraSummary}]`);
  }

  const selectionCount = assistantSelections?.length ?? 0;
  if (selectionCount > 0) {
    const previews =
      assistantSelections
        ?.slice(0, 2)
        .map((selection) => `"${selection.text.split("\n")[0] ?? ""}"`) ?? [];
    const extraCount = selectionCount - previews.length;
    const extraSummary = extraCount > 0 ? `（及其他 ${extraCount} 处）` : "";
    summaries.push(`[引用了 ${selectionCount} 处助手内容：${previews.join("、")}${extraSummary}]`);
  }

  return summaries.length > 0 ? summaries.join("\n") : null;
}

function buildMessageBlock(message: ChatMessage): string {
  const text =
    message.role === "user" ? stripEmbeddedAssistantSelections(message.text) : message.text;
  const attachments = attachmentSummary(message);

  if (text && attachments) {
    return `${messageRoleLabel(message)}:\n${text}\n${attachments}`;
  }
  if (text) {
    return `${messageRoleLabel(message)}:\n${text}`;
  }
  if (attachments) {
    return `${messageRoleLabel(message)}:\n${attachments}`;
  }
  return `${messageRoleLabel(message)}:\n（空消息）`;
}

function finalizeWithPrompt(
  transcriptBody: string,
  latestPrompt: string,
  maxChars: number,
): string | null {
  const text = `${BOOTSTRAP_PREAMBLE}\n\n${TRANSCRIPT_HEADER}\n${transcriptBody}\n\n${LATEST_PROMPT_HEADER}\n${latestPrompt}`;
  return text.length <= maxChars ? text : null;
}

export function buildBootstrapInput(
  previousMessages: ChatMessage[],
  latestPrompt: string,
  maxChars: number,
): BootstrapInputResult {
  const budget = Number.isFinite(maxChars) ? Math.max(1, Math.floor(maxChars)) : 1;
  const promptOnly = latestPrompt.length <= budget ? latestPrompt : latestPrompt.slice(0, budget);

  if (previousMessages.length === 0) {
    return {
      text: promptOnly,
      includedCount: 0,
      omittedCount: 0,
      truncated: promptOnly.length !== latestPrompt.length,
    };
  }

  const newestFirstBlocks: string[] = [];
  for (let index = previousMessages.length - 1; index >= 0; index -= 1) {
    const message = previousMessages[index];
    if (!message) continue;
    newestFirstBlocks.push(buildMessageBlock(message));
  }

  if (newestFirstBlocks.length === 0) {
    return {
      text: promptOnly,
      includedCount: 0,
      omittedCount: previousMessages.length,
      truncated: true,
    };
  }

  // Include a contiguous suffix from newest to oldest, then reverse to chronological.
  let includedNewestFirst: string[] = [];
  for (const block of newestFirstBlocks) {
    const nextNewestFirst = [...includedNewestFirst, block];
    const nextChronological = nextNewestFirst.toReversed();
    const omittedCount = newestFirstBlocks.length - nextChronological.length;
    const transcriptBody =
      omittedCount > 0
        ? `${OMITTED_SUMMARY(omittedCount)}\n\n${nextChronological.join("\n\n")}`
        : nextChronological.join("\n\n");
    if (!finalizeWithPrompt(transcriptBody, latestPrompt, budget)) {
      break;
    }
    includedNewestFirst = nextNewestFirst;
  }

  let includedChronological = includedNewestFirst.toReversed();
  while (true) {
    const omittedCount = newestFirstBlocks.length - includedChronological.length;
    const transcriptBody =
      omittedCount > 0
        ? includedChronological.length > 0
          ? `${OMITTED_SUMMARY(omittedCount)}\n\n${includedChronological.join("\n\n")}`
          : OMITTED_SUMMARY(omittedCount)
        : includedChronological.join("\n\n");
    const finalized = finalizeWithPrompt(transcriptBody, latestPrompt, budget);
    if (finalized) {
      return {
        text: finalized,
        includedCount: includedChronological.length,
        omittedCount,
        truncated: omittedCount > 0 || latestPrompt.length !== promptOnly.length,
      };
    }

    if (includedChronological.length === 0) {
      return {
        text: promptOnly,
        includedCount: 0,
        omittedCount: previousMessages.length,
        truncated: true,
      };
    }

    includedChronological = includedChronological.slice(1);
  }
}
