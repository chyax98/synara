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
    title: "默认提供商",
    keywords: "为新会话选择默认提供商。代理",
  },
  {
    id: "general:new-threads",
    section: "general",
    title: "新会话",
    keywords: "选择新建草稿会话的默认工作区模式。本地 工作树",
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
    keywords: "控制每个项目中会话的排列方式。排序 更新 创建",
  },
  {
    id: "general:chats-section",
    section: "general",
    title: "会话列表",
    keywords: "在侧边栏底部显示独立的会话列表（未绑定到项目的会话）。侧边栏 分区",
  },
  {
    id: "general:workspace-section",
    section: "general",
    title: "工作区",
    keywords: "在侧边栏切换器中显示工作区标签。会话标签始终可见。侧边栏 分区",
  },
  {
    id: "general:environment-repository",
    section: "general",
    title: "仓库",
    keywords: "在聊天环境面板中显示远程代码仓库链接。变更 工作树 分支",
  },
  {
    id: "general:environment-editor",
    section: "general",
    title: "编辑器",
    keywords: "在聊天环境面板中显示编辑器区块（应用内编辑器视图与「在编辑器中打开」选择器）。",
  },
  {
    id: "general:environment-recap",
    section: "general",
    title: "回顾",
    keywords: "在环境面板中显示自动生成的聊天回顾。",
  },
  {
    id: "general:environment-pinned",
    section: "general",
    title: "置顶消息",
    keywords: "在环境面板中显示置顶消息清单。",
  },
  {
    id: "general:environment-markers",
    section: "general",
    title: "文本标记",
    keywords: "在环境面板中显示高亮与下划线的对话文本。",
  },
  {
    id: "general:environment-notepad",
    section: "general",
    title: "记事本",
    keywords: "在环境面板中显示每个会话的记事本。",
  },

  // ── Appearance ───────────────────────────────────────────────────────────────
  {
    id: "appearance:theme",
    section: "appearance",
    title: "主题",
    keywords: "选择 Synara 在应用中的外观。深色 浅色 系统 颜色",
  },
  {
    id: "appearance:ui-density",
    section: "appearance",
    title: "界面密度",
    keywords: "控制侧边栏、输入区、聊天边距与设置行的间距，不改变字号。紧凑 舒适",
  },
  {
    id: "appearance:base-font-size",
    section: "appearance",
    title: "基础字号",
    keywords: "以像素调整应用文字基准。聊天与界面排版将按比例缩放。字体 字号",
  },
  {
    id: "appearance:terminal-font-size",
    section: "appearance",
    title: "终端字号",
    keywords: "独立于应用与聊天字号调整终端文字。",
  },
  {
    id: "appearance:terminal-font",
    section: "appearance",
    title: "终端字体",
    keywords: "输入本机已安装的等宽字体名称。留空则使用系统默认等宽字体",
  },
  {
    id: "appearance:font-smoothing",
    section: "appearance",
    title: "字体平滑",
    keywords: "使用苹果系统风格抗锯齿，使文字更轻、更清晰。",
    target: null,
  },
  {
    id: "appearance:time-format",
    section: "appearance",
    title: "时间格式",
    keywords: "系统默认跟随浏览器或操作系统的时钟偏好。时间戳 12小时 24小时 区域",
  },

  // ── Notifications ─────────────────────────────────────────────────────────────
  {
    id: "notifications:activity-toasts",
    section: "notifications",
    title: "活动通知",
    keywords: "当聊天或托管终端代理完成或需要输入时，显示应用内通知。提醒",
  },
  {
    id: "notifications:desktop-notifications",
    section: "notifications",
    title: "桌面通知",
    keywords: "当应用在后台时，若聊天或托管终端代理完成或需要输入，显示系统通知。提醒",
  },

  // ── Behavior ──────────────────────────────────────────────────────────────────
  {
    id: "behavior:assistant-output",
    section: "behavior",
    title: "助手输出",
    keywords: "在回复进行中逐词元显示输出。流式",
  },
  {
    id: "behavior:diff-line-wrapping",
    section: "behavior",
    title: "差异自动换行",
    keywords: "设置打开差异面板时的默认换行状态。自动换行",
  },
  {
    id: "behavior:prompt-suggestions",
    section: "behavior",
    title: "提示建议",
    keywords: "新建会话时在输入框下方显示建议提示。输入框 建议",
  },
  {
    id: "behavior:delete-confirmation",
    section: "behavior",
    title: "删除确认",
    keywords: "删除会话及聊天历史前进行确认。安全",
  },
  {
    id: "behavior:archive-confirmation",
    section: "behavior",
    title: "归档确认",
    keywords: "归档会话前进行确认。安全",
  },
  {
    id: "behavior:terminal-close-confirmation",
    section: "behavior",
    title: "关闭终端确认",
    keywords: "关闭终端标签并清除其历史前进行确认。安全",
  },

  // ── 快捷键 ────────────────────────────────────────────────────────────────────
  {
    id: "shortcuts:keyboard-shortcuts",
    section: "shortcuts",
    title: "快捷键",
    keywords:
      "Synara 中所有可用的键盘快捷键，按场景分组。keybindings hotkeys 按键 组合键 cmd ctrl 参考",
    target: null,
  },

  // ── Worktrees ─────────────────────────────────────────────────────────────────
  {
    id: "worktrees:managed-worktrees",
    section: "worktrees",
    title: "托管工作树",
    keywords: "查看并清理应用创建的工作树。分支 删除",
  },

  // ── Archived ──────────────────────────────────────────────────────────────────
  {
    id: "archived:archived-threads",
    section: "archived",
    title: "已归档会话",
    keywords: "查看并恢复已归档会话。取消归档 历史",
  },

  // ── Models ────────────────────────────────────────────────────────────────────
  {
    id: "models:model-catalog",
    section: "models",
    title: "模型目录",
    keywords: "OpenCode 模型提供商 Anthropic OpenAI 连接 认证 API Key OAuth 可见性 隐藏 显示 选单",
  },
  {
    id: "models:default-chat-model",
    section: "models",
    title: "默认聊天模型",
    keywords: "新建会话 默认模型 OpenCode providerID modelID 聊天",
  },
  {
    id: "models:git-writing-model",
    section: "models",
    title: "版本控制文案模型",
    keywords: "用于生成提交说明、合并请求标题与分支名。",
  },
  {
    id: "models:saved-model-slugs",
    section: "models",
    title: "自定义模型",
    keywords: "手动添加 OpenCode 模型代号 providerID modelID 自定义模型",
  },

  // ── Skills ────────────────────────────────────────────────────────────────────
  {
    id: "skills:skills",
    section: "skills",
    title: "技能",
    keywords: "各提供商中发现的所有技能，可开关控制可用性。代理",
  },

  // ── Advanced ──────────────────────────────────────────────────────────────────
  {
    id: "advanced:keybindings",
    section: "advanced",
    title: "快捷键",
    keywords: "打开持久化的快捷键配置文件以直接编辑高级绑定。快捷键",
  },
  {
    id: "advanced:recovery-tools",
    section: "advanced",
    title: "恢复工具",
    keywords: "当本地状态不同步时，重建本地项目索引且不清除现有聊天。",
  },
  {
    id: "advanced:version",
    section: "advanced",
    title: "版本",
    keywords: "当前应用版本。关于",
  },
  {
    id: "advanced:release-history",
    section: "advanced",
    title: "发布历史",
    keywords: "按时间倒序记录每次更新。更新日志 新功能 关于 发布说明",
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
