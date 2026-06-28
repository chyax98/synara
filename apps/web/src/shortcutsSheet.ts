// FILE: shortcutsSheet.ts
// Purpose: Build the shortcut reference sections shown by the keyboard shortcuts sheet.
// Layer: UI helper
// Depends on: keybinding label resolution, project script command mapping, and platform helpers.

import type { KeybindingCommand, ResolvedKeybindingsConfig } from "@t3tools/contracts";
import { isMacPlatform } from "./lib/utils";
import { shortcutLabelForCommand } from "./keybindings";
import { commandForProjectScript } from "./projectScripts";
import type { ProjectScript } from "./types";

export interface ShortcutSheetContext {
  terminalFocus: boolean;
  terminalOpen: boolean;
  terminalWorkspaceOpen: boolean;
  [key: string]: boolean;
}

export interface ShortcutSheetEntry {
  id: string;
  label: string;
  description: string;
  shortcutLabel: string;
}

export interface ShortcutSheetSection {
  id: string;
  title: string;
  description: string;
  tone?: "default" | "muted";
  entries: ShortcutSheetEntry[];
}

interface BuildShortcutSheetSectionsOptions {
  keybindings: ResolvedKeybindingsConfig;
  projectScripts: ReadonlyArray<ProjectScript>;
  platform: string;
  context: ShortcutSheetContext;
}

interface ShortcutDefinition {
  command: KeybindingCommand | readonly KeybindingCommand[];
  label: string;
  description: string;
}

const AVAILABLE_NOW_DEFINITIONS: readonly ShortcutDefinition[] = [
  {
    command: "sidebar.addProject",
    label: "添加项目",
    description: "打开文件夹选择器，将本地项目导入侧边栏。",
  },
  {
    command: "sidebar.search",
    label: "搜索项目与会话",
    description: "在应用任意位置打开侧边栏搜索面板。",
  },
  {
    command: "sidebar.importThread",
    label: "导入会话",
    description: "将已有对话导入当前工作区。",
  },
  {
    command: "chat.new",
    label: "新会话",
    description: "在当前项目中新建会话；若无活动项目则使用最近的项目。",
  },
  {
    command: "chat.newLatestProject",
    label: "在最近项目中新建会话",
    description: "在最近使用的项目中新建会话。",
  },
  {
    command: ["chat.newChat", "chat.newLocal"],
    label: "新聊天",
    description: "打开空白聊天起始页。",
  },
  {
    command: "chat.newTerminal",
    label: "新建终端会话",
    description: "创建直接进入终端模式的会话。",
  },
  {
    command: "chat.split",
    label: "分屏聊天",
    description: "在第二个窗格中打开当前对话。",
  },
  {
    command: "view.recent.previous",
    label: "上一个最近视图",
    description: "向后切换最近打开的主视图。",
  },
  {
    command: "view.recent.next",
    label: "下一个最近视图",
    description: "向前切换最近打开的主视图。",
  },
  {
    command: "modelPicker.toggle",
    label: "模型选择器",
    description: "打开输入区提供商与模型选择器。",
  },
  {
    command: "traitsPicker.toggle",
    label: "推理选择器",
    description: "打开输入区推理与特性控件。",
  },
  {
    command: "composer.focus.toggle",
    label: "聚焦输入区",
    description: "聚焦或取消聚焦聊天输入框。",
  },
  {
    command: "terminal.toggle",
    label: "切换终端",
    description: "显示或隐藏当前会话的终端界面。",
  },
  {
    command: "diff.toggle",
    label: "切换差异",
    description: "打开或关闭工作树差异面板。",
  },
  {
    command: "browser.toggle",
    label: "切换浏览器",
    description: "显示当前会话的内置浏览器面板。",
  },
  {
    command: "chat.visible.previous",
    label: "上一个可见会话",
    description: "切换到侧边栏中上一个当前可见的会话。",
  },
  {
    command: "chat.visible.next",
    label: "下一个可见会话",
    description: "切换到侧边栏中下一个当前可见的会话。",
  },
  {
    command: "editor.openFavorite",
    label: "在偏好编辑器中打开",
    description: "将当前会话或工作区目标发送到偏好编辑器。",
  },
] as const;

const THREAD_JUMP_DEFINITIONS: readonly ShortcutDefinition[] = Array.from(
  { length: 9 },
  (_, index) => ({
    command: `thread.jump.${index + 1}` as KeybindingCommand,
    label: `跳转到可见会话 ${index + 1}`,
    description: "通过侧边栏数字行直接聚焦可见会话。",
  }),
);

const WORKSPACE_DEFINITIONS: readonly ShortcutDefinition[] = [
  {
    command: "terminal.workspace.newFullWidth",
    label: "打开全宽终端工作区",
    description: "将当前会话展开为工作区终端布局。",
  },
  {
    command: "terminal.workspace.terminal",
    label: "聚焦终端标签",
    description: "将工作区切换到终端标签。",
  },
  {
    command: "terminal.workspace.chat",
    label: "聚焦聊天标签",
    description: "将工作区切换回聊天标签。",
  },
  {
    command: "terminal.workspace.closeActive",
    label: "关闭当前工作区面板",
    description: "关闭当前聚焦的工作区面板或标签。",
  },
] as const;

function modSlashLabel(platform: string): string {
  return isMacPlatform(platform) ? "⌘/" : "Ctrl+/";
}

function definitionToEntry(
  definition: ShortcutDefinition,
  keybindings: ResolvedKeybindingsConfig,
  platform: string,
  context: ShortcutSheetContext,
): ShortcutSheetEntry | null {
  const commands = Array.isArray(definition.command) ? definition.command : [definition.command];
  const shortcutLabel = commands.reduce<string | null>((resolved, command) => {
    if (resolved) return resolved;
    return shortcutLabelForCommand(keybindings, command, {
      platform,
      context,
    });
  }, null);
  if (!shortcutLabel) return null;
  return {
    id: commands[0] ?? definition.label,
    label: definition.label,
    description: definition.description,
    shortcutLabel,
  };
}

function definitionsToEntries(
  definitions: ReadonlyArray<ShortcutDefinition>,
  keybindings: ResolvedKeybindingsConfig,
  platform: string,
  context: ShortcutSheetContext,
): ShortcutSheetEntry[] {
  return definitions
    .map((definition) => definitionToEntry(definition, keybindings, platform, context))
    .filter((entry): entry is ShortcutSheetEntry => entry !== null);
}

export function buildShortcutSheetSections(
  options: BuildShortcutSheetSectionsOptions,
): ShortcutSheetSection[] {
  const sections: ShortcutSheetSection[] = [];

  const currentEntries: ShortcutSheetEntry[] = [
    {
      id: "shortcuts.show",
      label: "显示键盘快捷键",
      description: "在任意位置打开此面板，无需离开当前上下文。",
      shortcutLabel: modSlashLabel(options.platform),
    },
    ...definitionsToEntries(
      AVAILABLE_NOW_DEFINITIONS,
      options.keybindings,
      options.platform,
      options.context,
    ),
  ];

  const sidebarToggle = definitionToEntry(
    {
      command: "sidebar.toggle",
      label: "切换侧边栏",
      description: "折叠或展开侧边栏外壳。",
    },
    options.keybindings,
    options.platform,
    options.context,
  );
  if (sidebarToggle) {
    currentEntries.splice(1, 0, sidebarToggle);
  }

  const currentNavigationEntries = options.context.terminalWorkspaceOpen
    ? definitionsToEntries(
        WORKSPACE_DEFINITIONS,
        options.keybindings,
        options.platform,
        options.context,
      )
    : definitionsToEntries(
        THREAD_JUMP_DEFINITIONS,
        options.keybindings,
        options.platform,
        options.context,
      );

  sections.push({
    id: "available-now",
    title: "当前可用",
    description: options.context.terminalWorkspaceOpen
      ? "反映当前工作区终端上下文。"
      : "反映当前聊天与侧边栏上下文。",
    entries: [...currentEntries, ...currentNavigationEntries],
  });

  const alternateContext: ShortcutSheetContext = options.context.terminalWorkspaceOpen
    ? { ...options.context, terminalWorkspaceOpen: false }
    : {
        ...options.context,
        terminalOpen: true,
        terminalWorkspaceOpen: true,
      };
  const alternateDefinitions = options.context.terminalWorkspaceOpen
    ? THREAD_JUMP_DEFINITIONS
    : WORKSPACE_DEFINITIONS;
  const alternateEntries = definitionsToEntries(
    alternateDefinitions,
    options.keybindings,
    options.platform,
    alternateContext,
  );
  if (alternateEntries.length > 0) {
    sections.push({
      id: "alternate-context",
      title: options.context.terminalWorkspaceOpen ? "工作区模式外" : "工作区模式中",
      description: options.context.terminalWorkspaceOpen
        ? "关闭终端工作区后，数字行跳转将恢复。"
        : "终端切换到工作区模式时，这些绑定生效。",
      tone: "muted",
      entries: alternateEntries,
    });
  }

  const projectScriptEntries = options.projectScripts
    .map((script) => {
      const shortcutLabel = shortcutLabelForCommand(
        options.keybindings,
        commandForProjectScript(script.id),
        options.platform,
      );
      if (!shortcutLabel) return null;
      return {
        id: script.id,
        label: script.runOnWorktreeCreate ? `${script.name} 安装脚本` : script.name,
        description: script.runOnWorktreeCreate
          ? "直接从键盘运行项目安装脚本。"
          : "无需打开脚本菜单即可运行此项目脚本。",
        shortcutLabel,
      } satisfies ShortcutSheetEntry;
    })
    .filter((entry): entry is ShortcutSheetEntry => entry !== null);

  if (projectScriptEntries.length > 0) {
    sections.push({
      id: "project-scripts",
      title: "项目脚本",
      description: "为当前项目脚本定义的自定义快捷键。",
      entries: projectScriptEntries,
    });
  }

  return sections;
}

// Match a single entry against a free-text query on the human-readable label, the
// description, and the rendered shortcut label, so a user can search by action name
// ("terminal"), intent ("split"), or even the key combo itself ("⌘N" / "ctrl+n").
function shortcutSheetEntryMatchesQuery(entry: ShortcutSheetEntry, needle: string): boolean {
  return (
    entry.label.toLowerCase().includes(needle) ||
    entry.description.toLowerCase().includes(needle) ||
    entry.shortcutLabel.toLowerCase().includes(needle)
  );
}

// Filter each section's entries against a free-text query, dropping sections that end up
// empty. Shared by the keyboard-shortcuts dialog (Mod+/) and the settings reference panel
// so the two surfaces search identically.
export function filterShortcutSheetSections(
  sections: ShortcutSheetSection[],
  query: string,
): ShortcutSheetSection[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) return sections;
  return sections
    .map((section) => ({
      ...section,
      entries: section.entries.filter((entry) => shortcutSheetEntryMatchesQuery(entry, trimmed)),
    }))
    .filter((section) => section.entries.length > 0);
}
