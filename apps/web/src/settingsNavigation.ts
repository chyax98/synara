// FILE: settingsNavigation.ts
// Purpose: Share the settings topic taxonomy between the main sidebar and the settings screen.
// Layer: Route/UI support
// Exports: section ids, nav items, and search normalization helper

export const SETTINGS_SECTION_IDS = [
  "general",
  "profile",
  "appearance",
  "notifications",
  "behavior",
  "shortcuts",
  "worktrees",
  "archived",
  "models",
  "providers",
  "skills",
  "advanced",
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];
export type SettingsNavGroupId = "app" | "synara";

/**
 * Deep-link scroll targets inside a settings panel. Each id is shared by the element that owns
 * it (its `id` + scroll ref), the panel effect that scrolls it into view, and any caller that
 * navigates to it via `?target=…`. Centralizing them keeps the anchor and its links from
 * silently drifting apart.
 */
export const SETTINGS_TARGETS = {
  environmentPanel: "environment-panel",
} as const;

export type SettingsTargetId = (typeof SETTINGS_TARGETS)[keyof typeof SETTINGS_TARGETS];

export type SettingsNavItem = {
  id: SettingsSectionId;
  group: SettingsNavGroupId;
  label: string;
  description: string;
  /** Basename of a SVG under `/central-icons-reversed`. */
  icon: string;
  eyebrow: string;
};

export const SETTINGS_NAV_GROUPS: ReadonlyArray<{
  id: SettingsNavGroupId;
  label: string;
}> = [
  { id: "app", label: "应用" },
  { id: "synara", label: "Synara" },
] as const;

export const SETTINGS_NAV_ITEMS: readonly SettingsNavItem[] = [
  {
    id: "general",
    group: "app",
    label: "通用",
    description: "默认提供商、会话模式和侧边栏组织。",
    icon: "settings-gear-1",
    eyebrow: "工作流默认",
  },
  {
    id: "profile",
    group: "app",
    label: "个人资料",
    description: "本地活动、连续记录和可分享的数据卡片。",
    icon: "user",
    eyebrow: "你的数据",
  },
  {
    id: "appearance",
    group: "app",
    label: "外观",
    description: "主题、字体和时间戳格式。",
    icon: "color-palette",
    eyebrow: "视觉语言",
  },
  {
    id: "notifications",
    group: "app",
    label: "通知",
    description: "应用内通知和桌面提醒。",
    icon: "bell",
    eyebrow: "提醒",
  },
  {
    id: "behavior",
    group: "app",
    label: "行为",
    description: "流式输出、差异处理和危险操作确认。",
    icon: "settings-slider-hor",
    eyebrow: "交互规则",
  },
  {
    id: "shortcuts",
    group: "app",
    label: "Keyboard Shortcuts",
    description: "Every keyboard shortcut available in Synara, grouped by context.",
    icon: "shortcut",
    eyebrow: "Key bindings",
  },
  {
    id: "worktrees",
    group: "app",
    label: "工作树",
    description: "查看并清理 Synara 创建的工作树。",
    icon: "branch-simple",
    eyebrow: "工作区管理",
  },
  {
    id: "archived",
    group: "app",
    label: "归档",
    description: "查看并恢复已归档的会话。",
    icon: "archive",
    eyebrow: "会话管理",
  },
  {
    id: "models",
    group: "synara",
    label: "模型",
    description: "版本控制文案默认设置和自定义模型代号。",
    icon: "brain",
    eyebrow: "AI 配置",
  },
  {
    id: "providers",
    group: "synara",
    label: "提供商",
    description: "OpenCode 是唯一提供商，无需额外配置。",
    icon: "puzzle",
    eyebrow: "选择器可见性",
  },
  {
    id: "skills",
    group: "synara",
    label: "技能",
    description: "跨提供商发现的所有技能，可开关可用性。",
    icon: "building-blocks",
    eyebrow: "代理技能",
  },
  {
    id: "advanced",
    group: "synara",
    label: "高级",
    description: "快捷键、恢复工具和版本信息。",
    icon: "toolbox",
    eyebrow: "系统工具",
  },
] as const;

/**
 * Stable DOM id for a settings row, derived from its (string) title. Shared by the row that
 * renders the anchor and by the search index that deep-links to it via `?target=…`, so the
 * two can't drift. Panels mount one section at a time, so the slug only needs to be unique
 * within a section.
 */
export function settingRowAnchorId(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `setting-${slug}`;
}

export function normalizeSettingsSection(value: unknown): SettingsSectionId {
  if (typeof value !== "string") {
    return "general";
  }
  return SETTINGS_SECTION_IDS.find((candidate) => candidate === value) ?? "general";
}
