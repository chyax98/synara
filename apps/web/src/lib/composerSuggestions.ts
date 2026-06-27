// FILE: composerSuggestions.ts
// Purpose: Derives empty-chat prompt suggestions from recent project conversation context.
// Layer: Web composer helper
// Depends on: shared web Thread/Project view models.

import type { Project, Thread } from "../types";

export interface ComposerSuggestion {
  id: string;
  label: string;
  description?: string | undefined;
  prompt: string;
  sourceThreadId?: Thread["id"] | undefined;
}

interface DeriveComposerSuggestionsInput {
  activeThreadId: Thread["id"] | null;
  project: Project | null | undefined;
  threads: readonly Thread[];
}

const MAX_SUGGESTIONS = 3;
const MIN_SUGGESTIONS = 3;
const MAX_PROMPT_LINES = 6;
const MAX_TOPIC_LENGTH = 72;

function normalizeInlineText(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " code block ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value: string, maxLength: number): string {
  const normalized = normalizeInlineText(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function compactPromptLines(lines: readonly string[]): string {
  return lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, MAX_PROMPT_LINES)
    .join("\n");
}

function projectLabel(project: Project | null | undefined): string {
  return (
    project?.localName?.trim() || project?.name?.trim() || project?.folderName?.trim() || "此项目"
  );
}

function latestUserPrompt(thread: Thread): string | null {
  for (let index = thread.messages.length - 1; index >= 0; index -= 1) {
    const message = thread.messages[index];
    if (message?.role !== "user") {
      continue;
    }
    const text = normalizeInlineText(message.text);
    if (text.length > 0) {
      return text;
    }
  }
  return null;
}

function threadTopic(thread: Thread): string {
  const title = normalizeInlineText(thread.title);
  if (title.length > 0 && title.toLowerCase() !== "new chat") {
    return truncateText(title, MAX_TOPIC_LENGTH);
  }
  const prompt = latestUserPrompt(thread);
  return prompt ? truncateText(prompt, MAX_TOPIC_LENGTH) : "最近的聊天";
}

function threadFreshnessTime(thread: Thread): number {
  const candidates = [thread.latestUserMessageAt, thread.updatedAt, thread.createdAt];
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const time = Date.parse(candidate);
    if (!Number.isNaN(time)) {
      return time;
    }
  }
  return 0;
}

function recentProjectThreads(input: DeriveComposerSuggestionsInput): Thread[] {
  const projectId = input.project?.id ?? null;
  if (!projectId) {
    return [];
  }
  return input.threads
    .filter((thread) => {
      if (thread.id === input.activeThreadId) {
        return false;
      }
      if (thread.projectId !== projectId || thread.archivedAt) {
        return false;
      }
      return thread.messages.some((message) => message.role === "user" && message.text.trim());
    })
    .sort((left, right) => threadFreshnessTime(right) - threadFreshnessTime(left))
    .slice(0, 8);
}

function pushUniqueSuggestion(
  suggestions: ComposerSuggestion[],
  suggestion: ComposerSuggestion,
): void {
  const signature = suggestion.label.toLowerCase();
  if (suggestions.some((existing) => existing.label.toLowerCase() === signature)) {
    return;
  }
  suggestions.push(suggestion);
}

export function deriveComposerSuggestions(
  input: DeriveComposerSuggestionsInput,
): ComposerSuggestion[] {
  const suggestions: ComposerSuggestion[] = [];
  const recentThreads = recentProjectThreads(input);
  const label = projectLabel(input.project);
  const [latestThread, secondThread] = recentThreads;

  if (latestThread) {
    const topic = threadTopic(latestThread);
    pushUniqueSuggestion(suggestions, {
      id: `continue:${latestThread.id}`,
      label: `继续「${topic}」`,
      description: "从最近的相关对话继续推进",
      prompt: compactPromptLines([
        `继续推进「${topic}」的近期工作。`,
        "结合当前项目状态与最新聊天上下文。",
        "确定下一步具体行动，并干净地实现它。",
      ]),
      sourceThreadId: latestThread.id,
    });
  }

  if (secondThread) {
    const topic = threadTopic(secondThread);
    pushUniqueSuggestion(suggestions, {
      id: `review:${secondThread.id}`,
      label: `审查「${topic}」的遗漏`,
      description: "检查上一轮对话中可能遗漏的边界情况",
      prompt: compactPromptLines([
        `审查 ${label} 中「${topic}」的近期工作。`,
        "查找回归、遗漏的边界情况，以及能覆盖它们的测试。",
        "优先修复影响最大的问题。",
      ]),
      sourceThreadId: secondThread.id,
    });
  }

  if (latestThread && secondThread) {
    pushUniqueSuggestion(suggestions, {
      id: `connect:${latestThread.id}:${secondThread.id}`,
      label: `串联最近两个 ${label} 会话`,
      description: "把近期上下文整合成下一步行动",
      prompt: compactPromptLines([
        `以 ${label} 的最新聊天为上下文。`,
        `串联「${threadTopic(latestThread)}」与「${threadTopic(secondThread)}」。`,
        "总结共同目标，然后提出并开始下一个连贯步骤。",
      ]),
      sourceThreadId: latestThread.id,
    });
  }

  pushUniqueSuggestion(suggestions, {
    id: "project-next-step",
    label: `找出 ${label} 的下一个最佳任务`,
    description: "浏览近期工作并选择收益最高的行动",
    prompt: compactPromptLines([
      `查看 ${label} 的近期工作与当前仓库状态。`,
      "选出下一个高收益任务，说明其重要性，并从最安全的小改动开始。",
    ]),
  });

  pushUniqueSuggestion(suggestions, {
    id: "project-quality-pass",
    label: `对 ${label} 做一次聚焦质量检查`,
    description: "收紧行为、打磨细节并完善失败状态",
    prompt: compactPromptLines([
      `审查 ${label} 中近期工作最可能出现的粗糙边界。`,
      "在改代码前先检查界面行为、数据流和失败状态。",
      "然后修复能提升可靠性的最小问题。",
    ]),
  });

  while (suggestions.length < MIN_SUGGESTIONS) {
    const index = suggestions.length + 1;
    pushUniqueSuggestion(suggestions, {
      id: `starter:${index}`,
      label:
        index === 1
          ? `规划 ${label} 的下一项改进`
          : index === 2
            ? `检查 ${label} 的快速收益点`
            : `准备清晰的 ${label} 交接`,
      description:
        index === 1
          ? "选择一个明确的下一步"
          : index === 2
            ? "找一个小而实用的改进"
            : "记录上下文与风险",
      prompt:
        index === 1
          ? compactPromptLines([`查看 ${label} 的当前状态。`, "提出简洁的下一步并开始实现。"])
          : index === 2
            ? compactPromptLines([`在 ${label} 中找一个小改进。`, "优先可靠性、打磨或工作流速度。"])
            : compactPromptLines([
                `总结 ${label} 当前最重要的事项。`,
                "列出风险、待决事项和下一个实现步骤。",
              ]),
    });
  }

  return suggestions.slice(0, MAX_SUGGESTIONS);
}
