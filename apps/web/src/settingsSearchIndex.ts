// FILE: settingsSearchIndex.ts
// Purpose: Declarative, searchable index of settings rows/sections so the sidebar can
//          surface matches by title/description the same way the editor file search does.
// Layer: Route/UI support
// Exports: entry type, the index, section label lookup, and the ranking helper

import { rankProviderDiscoveryItems } from "~/lib/providerDiscovery";
import {
  settingRowAnchorId,
  SETTINGS_NAV_ITEMS,
  type SettingsSectionId,
} from "./settingsNavigation";

/**
 * One searchable settings result. `title` usually matches a string SettingsRow heading so
 * the default anchor can be derived; `target: null` marks panel-only or conditional rows.
 */
export interface SettingsSearchEntry {
  id: string;
  section: SettingsSectionId;
  title: string;
  keywords: string;
  target?: string | null;
}

/** DOM id a result deep-links to, or null for panel-level entries with no anchored row. */
export function settingsSearchEntryTarget(entry: SettingsSearchEntry): string | null {
  return entry.target === undefined ? settingRowAnchorId(entry.title) : entry.target;
}

// Mirrors row titles/descriptions rendered in settings panels. Panels only mount the active
// section, so the sidebar cannot read row text at runtime; keep this list in sync when rows
// are added, renamed, hidden conditionally, or represented as panel-level results.
export const SETTINGS_SEARCH_ENTRIES: readonly SettingsSearchEntry[] = [
  // ── General ────────────────────────────────────────────────────────────────
  {
    id: "general:default-provider",
    section: "general",
    title: "默认 provider",
    keywords: "为新会话选择默认 provider。agent codex claude",
  },
  {
    id: "general:new-threads",
    section: "general",
    title: "新会话",
    keywords:
      "Pick the default workspace mode for newly created draft threads. local worktree environment",
  },
  {
    id: "general:project-order",
    section: "general",
    title: "项目排序",
    keywords: "控制主侧边栏中项目的排列方式。排序 更新 创建 手动",
  },
  {
    id: "general:thread-order",
    section: "general",
    title: "会话排序",
    keywords:
      "Controls how threads are arranged inside each project in the main sidebar. sort updated created",
  },
  {
    id: "general:chats-section",
    section: "general",
    title: "会话列表",
    keywords:
      "Show the standalone Chats list in the sidebar footer chats not tied to a project. sidebar section",
  },
  {
    id: "general:workspace-section",
    section: "general",
    title: "工作区",
    keywords:
      "Show the Workspace tab in the sidebar switcher. The Threads tab always stays visible. sidebar section",
  },
  {
    id: "general:environment-repository",
    section: "general",
    title: "仓库",
    keywords: "Show the GitHub repository link in the chat Environment panel. git changes worktree",
  },
  {
    id: "general:environment-editor",
    section: "general",
    title: "编辑器",
    keywords:
      "Show the Editor section in-app editor view and Open in editor picker in the chat Environment panel.",
  },
  {
    id: "general:environment-recap",
    section: "general",
    title: "Recap",
    keywords: "Show the auto-generated chat recap in the Environment panel.",
  },
  {
    id: "general:environment-pinned",
    section: "general",
    title: "置顶消息",
    keywords: "Show the pinned-messages checklist in the Environment panel.",
  },
  {
    id: "general:environment-markers",
    section: "general",
    title: "文本标记",
    keywords: "Show highlighted and underlined transcript text in the Environment panel.",
  },
  {
    id: "general:environment-notepad",
    section: "general",
    title: "记事本",
    keywords: "Show the per-thread notepad in the Environment panel.",
  },

  // ── Appearance ───────────────────────────────────────────────────────────────
  {
    id: "appearance:theme",
    section: "appearance",
    title: "主题",
    keywords: "Choose how Synara looks across the app. dark light system color",
  },
  {
    id: "appearance:ui-density",
    section: "appearance",
    title: "UI 密度",
    keywords:
      "Control spacing in the sidebar, composer, chat gutters, and settings rows without changing font size. compact comfortable",
  },
  {
    id: "appearance:base-font-size",
    section: "appearance",
    title: "基础字号",
    keywords:
      "Adjust the app text base in pixels. Chat and UI typography scale proportionally. font",
  },
  {
    id: "appearance:terminal-font-size",
    section: "appearance",
    title: "终端字号",
    keywords: "独立于应用与聊天字号调整终端文字 terminal font size",
  },
  {
    id: "appearance:terminal-font",
    section: "appearance",
    title: "终端字体",
    keywords: "输入本机已安装的等宽字体，例如 Fira Code。系统默认等宽字体",
  },
  {
    id: "appearance:font-smoothing",
    section: "appearance",
    title: "字体平滑",
    keywords: "使用 macOS 风格抗锯齿，使文字更轻、更清晰。",
    target: null,
  },
  {
    id: "appearance:time-format",
    section: "appearance",
    title: "时间格式",
    keywords:
      "System default follows your browser or OS clock preference. timestamp 12-hour 24-hour locale",
  },

  // ── Notifications ─────────────────────────────────────────────────────────────
  {
    id: "notifications:activity-toasts",
    section: "notifications",
    title: "活动通知",
    keywords:
      "Show an in-app toast when a chat or managed terminal agent finishes or needs input. alerts",
  },
  {
    id: "notifications:desktop-notifications",
    section: "notifications",
    title: "桌面通知",
    keywords:
      "Show an OS notification when a chat or managed terminal agent finishes or needs input while the app is in the background. alerts toast",
  },

  // ── Behavior ──────────────────────────────────────────────────────────────────
  {
    id: "behavior:assistant-output",
    section: "behavior",
    title: "助手输出",
    keywords: "在回复进行中逐 token 显示输出。流式 streaming",
  },
  {
    id: "behavior:diff-line-wrapping",
    section: "behavior",
    title: "Diff 自动换行",
    keywords: "设置打开 diff 面板时的默认换行状态。自动换行 word wrap",
  },
  {
    id: "behavior:prompt-suggestions",
    section: "behavior",
    title: "提示建议",
    keywords:
      "Show suggested prompts under the composer when starting a new thread. composer suggestions",
  },
  {
    id: "behavior:delete-confirmation",
    section: "behavior",
    title: "删除确认",
    keywords: "删除会话及聊天历史前进行确认。安全 confirm",
  },
  {
    id: "behavior:archive-confirmation",
    section: "behavior",
    title: "归档确认",
    keywords: "归档会话前进行确认。安全 confirm",
  },
  {
    id: "behavior:terminal-close-confirmation",
    section: "behavior",
    title: "关闭 Terminal 确认",
    keywords: "关闭终端标签并清除其历史前进行确认。安全 confirm",
  },

  // ── Worktrees ─────────────────────────────────────────────────────────────────
  {
    id: "worktrees:managed-worktrees",
    section: "worktrees",
    title: "托管 worktree",
    keywords: "Review and clean up the worktrees created by Synara. git branch remove",
    target: null,
  },

  // ── Archived ──────────────────────────────────────────────────────────────────
  {
    id: "archived:archived-threads",
    section: "archived",
    title: "已归档会话",
    keywords: "查看并恢复已归档会话。取消归档 历史",
    target: null,
  },

  // ── Models ────────────────────────────────────────────────────────────────────
  {
    id: "models:git-writing-model",
    section: "models",
    title: "Git 文案模型",
    keywords: "Used for generated commit messages, PR titles, and branch names.",
  },
  {
    id: "models:saved-model-slugs",
    section: "models",
    title: "已保存 model 代号",
    keywords: "Add custom model slugs for supported providers. custom model",
  },

  // ── Providers ─────────────────────────────────────────────────────────────────
  {
    id: "providers:visible-providers",
    section: "providers",
    title: "可见 provider",
    keywords:
      "Drag providers into your preferred picker order and hide the ones you don't use. visibility order",
  },
  {
    id: "providers:provider-updates",
    section: "providers",
    title: "Provider 更新",
    keywords: "Update installed provider tools that Synara can safely update. upgrade cli",
  },
  {
    id: "providers:installed-clis",
    section: "providers",
    title: "已安装 CLI",
    keywords: "查看 provider 版本并更新工具。二进制 覆盖 路径 安装",
  },

  // ── Skills ────────────────────────────────────────────────────────────────────
  {
    id: "skills:skills",
    section: "skills",
    title: "Skill",
    keywords: "各 provider 中发现的所有技能，可开关控制可用性。agent",
    target: null,
  },

  // ── Advanced ──────────────────────────────────────────────────────────────────
  {
    id: "advanced:keybindings",
    section: "advanced",
    title: "快捷键",
    keywords:
      "Open the persisted keybindings.json file to edit advanced bindings directly. shortcuts",
  },
  {
    id: "advanced:recovery-tools",
    section: "advanced",
    title: "恢复工具",
    keywords:
      "Rebuild local project indexes without clearing existing chats when the local state gets out of sync.",
  },
  {
    id: "advanced:version",
    section: "advanced",
    title: "版本",
    keywords: "当前应用版本。关于 about",
  },
  {
    id: "advanced:release-history",
    section: "advanced",
    title: "发布历史",
    keywords:
      "A running log of every update, newest first. changelog what's new about release notes",
  },
] as const;

const SETTINGS_SECTION_LABEL_BY_ID = new Map<SettingsSectionId, string>(
  SETTINGS_NAV_ITEMS.map((item) => [item.id, item.label]),
);

export function settingsSectionLabel(section: SettingsSectionId): string {
  return SETTINGS_SECTION_LABEL_BY_ID.get(section) ?? section;
}

/**
 * Fuzzy-rank settings rows for the sidebar search. Title carries the strongest intent;
 * the description/synonym keywords and the owning section label match more loosely so a
 * query like "appearance" or "wrap" still surfaces the right rows.
 */
export function rankSettingsSearchEntries(
  query: string,
  limit: number,
): readonly SettingsSearchEntry[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return [];
  }
  const ranked = rankProviderDiscoveryItems(SETTINGS_SEARCH_ENTRIES, trimmed, (entry) => [
    { value: entry.title },
    { value: entry.keywords, weight: 200 },
    { value: settingsSectionLabel(entry.section), weight: 400 },
  ]);
  return ranked.slice(0, limit);
}
