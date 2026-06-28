// FILE: _chat.settings.tsx
// Purpose: Render the dedicated settings experience with its own section sidebar and grouped panels.
// Layer: Route screen
// Exports: Settings route component for `/settings`

import { type ThreadId, DEFAULT_GIT_TEXT_GENERATION_MODEL } from "@t3tools/contracts";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type AppSettings,
  DEFAULT_UI_DENSITY,
  type UiDensity,
  MAX_CHAT_FONT_SIZE_PX,
  MAX_TERMINAL_FONT_SIZE_PX,
  MIN_CHAT_FONT_SIZE_PX,
  MIN_TERMINAL_FONT_SIZE_PX,
  normalizeChatFontSizePx,
  normalizeTerminalFontFamily,
  normalizeTerminalFontSizePx,
  TERMINAL_FONT_FAMILY_SUGGESTIONS,
  useAppSettings,
} from "../appSettings";
import { APP_VERSION } from "../branding";
import { useDesktopTopBarTrafficLightGutterClassName } from "../hooks/useDesktopTopBarGutter";

import {
  Autocomplete,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompletePopup,
} from "../components/ui/autocomplete";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  SettingResetButton,
  SettingsSegmentedControl,
  SettingsSelectControl,
} from "../components/settings/SettingControls";
import { SelectItem } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { toastManager } from "../components/ui/toast";
import { ThemePackEditor } from "../components/ThemePackEditor";
import { DebouncedSettingTextInput } from "../components/settings/DebouncedSettingTextInput";
import {
  SettingsCard,
  SettingsRow,
  SettingsSection,
  SettingsSelectPopup,
} from "../components/settings/SettingsPanelPrimitives";

import { ProfileSettingsPanel } from "../components/settings/ProfileSettingsPanel";
import { KeyboardShortcutsSettingsPanel } from "../components/settings/KeyboardShortcutsSettingsPanel";
import { DefaultChatModelSettingsRow } from "../components/settings/DefaultChatModelSettingsRow";
import { GitTextGenerationModelSettingsRow } from "../components/settings/GitTextGenerationModelSettingsRow";
import { ModelProvidersSettingsPanel } from "../components/settings/ModelProvidersSettingsPanel";
import { SkillsSettingsPanel } from "../components/settings/SkillsSettingsPanel";
import {
  CHAT_CONTENT_CARD_CLASS_NAME,
  CHAT_MAIN_VIEWPORT_SHELL_CLASS_NAME,
} from "../components/chat/composerPickerStyles";
import {
  CHAT_SURFACE_HEADER_HEIGHT_CLASS,
  CHAT_SURFACE_HEADER_PADDING_X_CLASS,
} from "../components/chat/chatHeaderControls";
import { SidebarHeaderNavigationControls } from "../components/SidebarHeaderNavigationControls";
import { RouteInsetSurface } from "../components/RouteInsetSurface";

import { resolveAndPersistPreferredEditor } from "../editorPreferences";
import { isElectron } from "../env";
import { useTheme } from "../hooks/useTheme";
import { isUiDensity } from "../lib/appDensity";
import { gitRemoveWorktreeMutationOptions } from "../lib/gitReactQuery";
import {
  deleteArchivedThreadFromClient,
  deleteArchivedThreadsFromClient,
} from "../lib/archivedThreadDelete";
import {
  ArchiveIcon,
  ChevronDownIcon,
  DeviceLaptopIcon,
  MoonIcon,
  RotateCcwIcon,
  SunIcon,
} from "../lib/icons";
import {
  serverConfigQueryOptions,
  serverQueryKeys,
  serverSettingsQueryOptions,
  serverWorktreesQueryOptions,
} from "../lib/serverReactQuery";
import { cn, isMacPlatform } from "../lib/utils";
import { newCommandId } from "../lib/utils";
import { ensureNativeApi, readNativeApi } from "../nativeApi";
import {
  buildNotificationSettingsSupportText,
  readBrowserNotificationPermissionState,
  requestBrowserNotificationPermission,
} from "../notifications/taskCompletion";
import {
  normalizeSettingsSection,
  SETTINGS_NAV_ITEMS,
  SETTINGS_TARGETS,
} from "../settingsNavigation";
import {
  SETTINGS_EMPTY_STATE_CLASS_NAME,
  SETTINGS_INSET_LIST_CLASS_NAME,
  SETTINGS_PAGE_BACKGROUND_CLASS_NAME,
  SETTINGS_PANEL_SECTION_CLASS_NAME,
  SETTINGS_RADIUS_CLASS_NAME,
  SETTINGS_SECTION_LABEL_CLASS_NAME,
} from "../settingsPanelStyles";
import { useStore } from "../store";

import { createAllThreadsMessagelessSelector, createThreadShellsSelector } from "../storeSelectors";
import { formatRelativeTime } from "../lib/relativeTime";
import { formatWorktreePathForDisplay } from "../worktreeCleanup";

// ── Settings taxonomy ──────────────────────────────────────────────────────

const UI_DENSITY_OPTIONS = [
  {
    value: "compact",
    label: "紧凑",
    description: "侧边栏、输入区与设置行间距更紧。",
  },
  {
    value: "comfortable",
    label: "舒适",
    description: "日常使用的均衡间距。",
  },
  {
    value: "spacious",
    label: "宽松",
    description: "主工作区各界面留白更多。",
  },
] as const satisfies ReadonlyArray<{
  value: UiDensity;
  label: string;
  description: string;
}>;

const THEME_OPTIONS = [
  {
    value: "light",
    label: "浅色",
    description: "始终使用浅色主题。",
    icon: <SunIcon />,
  },
  {
    value: "dark",
    label: "深色",
    description: "始终使用深色主题。",
    icon: <MoonIcon />,
  },
  {
    value: "system",
    label: "跟随系统",
    description: "与操作系统外观设置一致。",
    icon: <DeviceLaptopIcon />,
  },
] as const;

const TIMESTAMP_FORMAT_LABELS = {
  locale: "系统默认",
  "12-hour": "12 小时制",
  "24-hour": "24 小时制",
} as const;

const SIDEBAR_PROJECT_SORT_ORDER_LABELS = {
  updated_at: "最近活跃",
  created_at: "最近添加",
  manual: "手动排序",
} as const;

const SIDEBAR_THREAD_SORT_ORDER_LABELS = {
  updated_at: "最近活跃",
  created_at: "最新优先",
} as const;

// ── Settings UI primitives ────────────────────────────────────────────────

// Shared settings controls live in ~/components/settings/SettingControls.

function normalizeManagedWorktreePath(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

// Keys of AppSettings whose value is a plain boolean — the only ones that can be
// driven by the shared on/off toggle row below.
type BooleanSettingKey = {
  [Key in keyof AppSettings]-?: AppSettings[Key] extends boolean ? Key : never;
}[keyof AppSettings];

// ── Route screen ───────────────────────────────────────────────────────────

// Scroll a deep-linked settings section into view when it becomes the active `?target=…`.
// `retriggerKey` lets a panel re-attempt after late-loading data mounts the target element.
function useSettingsTargetScroll(
  active: boolean,
  ref: RefObject<HTMLElement | null>,
  retriggerKey?: unknown,
): void {
  useEffect(() => {
    if (!active) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [active, ref, retriggerKey]);
}

function SettingsRouteView() {
  const routeSearch = useSearch({ strict: false }) as Record<string, unknown>;
  const activeSection = normalizeSettingsSection(routeSearch.section);
  const settingsTarget = typeof routeSearch.target === "string" ? routeSearch.target : null;
  const activeSectionItem = SETTINGS_NAV_ITEMS.find((item) => item.id === activeSection)!;

  const { isDefaultActiveTheme, resetAllThemes, resolvedTheme, theme, setTheme } = useTheme();
  const { settings, defaults, updateSettings, resetSettings } = useAppSettings();
  const desktopTopBarTrafficLightGutterClassName = useDesktopTopBarTrafficLightGutterClassName();
  const queryClient = useQueryClient();
  const serverConfigQuery = useQuery(serverConfigQueryOptions());
  const serverSettingsQuery = useQuery(serverSettingsQueryOptions());
  const serverWorktreesQuery = useQuery(serverWorktreesQueryOptions());
  const removeWorktreeMutation = useMutation(gitRemoveWorktreeMutationOptions({ queryClient }));
  const removeDeletedThreadFromClientState = useStore(
    (store) => store.removeDeletedThreadFromClientState,
  );
  const syncServerShellSnapshot = useStore((store) => store.syncServerShellSnapshot);
  const syncServerReadModel = useStore((store) => store.syncServerReadModel);
  // Shell-level subscription on purpose: the full-thread selector invalidates on every
  // streaming message/activity tick, which would re-render this whole route while a
  // turn is running. Settings only needs thread metadata (and message emptiness below).
  const threadShells = useStore(useMemo(() => createThreadShellsSelector(), []));
  const allThreadsMessageless = useStore(useMemo(() => createAllThreadsMessagelessSelector(), []));
  const projects = useStore((store) => store.projects);
  const threadsHydrated = useStore((store) => store.threadsHydrated);
  const archivedThreads = useMemo(
    () => threadShells.filter((thread) => thread.archivedAt != null),
    [threadShells],
  );
  const shouldOfferRecoveryTools = useMemo(() => {
    if (!threadsHydrated || projects.length === 0) {
      return false;
    }
    return threadShells.length === 0 || allThreadsMessageless;
  }, [allThreadsMessageless, projects.length, threadShells.length, threadsHydrated]);

  const [isOpeningKeybindings, setIsOpeningKeybindings] = useState(false);
  const [isRepairingLocalState, setIsRepairingLocalState] = useState(false);
  const [showRecoveryTools, setShowRecoveryTools] = useState(false);

  const [openKeybindingsError, setOpenKeybindingsError] = useState<string | null>(null);
  const environmentPanelRef = useRef<HTMLDivElement | null>(null);
  const [browserNotificationPermission, setBrowserNotificationPermission] = useState(
    readBrowserNotificationPermissionState(),
  );
  const shouldShowFontSmoothing = isMacPlatform(
    typeof navigator === "undefined" ? "" : navigator.platform,
  );
  const visibleTerminalFontFamilySuggestions = useMemo(() => {
    const query = settings.terminalFontFamily.trim().toLowerCase();
    if (!query) return TERMINAL_FONT_FAMILY_SUGGESTIONS;
    return TERMINAL_FONT_FAMILY_SUGGESTIONS.filter((suggestion) =>
      suggestion.toLowerCase().includes(query),
    );
  }, [settings.terminalFontFamily]);

  const keybindingsConfigPath = serverConfigQuery.data?.keybindingsConfigPath ?? null;
  const availableEditors = serverConfigQuery.data?.availableEditors;

  // Deep-link target for the chat Environment panel's gear button (see EnvironmentPanel).
  useSettingsTargetScroll(
    activeSection === "general" && settingsTarget === SETTINGS_TARGETS.environmentPanel,
    environmentPanelRef,
  );

  // Sidebar search deep-links to an individual row via its `settingRowAnchorId`. The active
  // panel renders synchronously with this section change, so scroll once the row has mounted.
  useEffect(() => {
    if (!settingsTarget || !settingsTarget.startsWith("setting-")) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(settingsTarget)
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeSection, settingsTarget]);
  const managedWorktrees = serverWorktreesQuery.data?.worktrees;
  const worktreesByWorkspaceRoot = useMemo(() => {
    type WorktreeGroup = {
      workspaceRoot: string;
      worktrees: Array<{
        path: string;
        linkedThreads: typeof threadShells;
      }>;
    };
    // Map keeps grouping O(worktrees) instead of the previous O(worktrees²) `groups.find`,
    // while `groups` preserves the original first-seen workspace-root order.
    const groups: WorktreeGroup[] = [];
    const groupByRoot = new Map<string, WorktreeGroup>();
    for (const worktree of managedWorktrees ?? []) {
      const linkedThreads = threadShells.filter((thread) => {
        const candidatePaths = [
          normalizeManagedWorktreePath(thread.worktreePath),
          normalizeManagedWorktreePath(thread.associatedWorktreePath),
        ];
        return candidatePaths.includes(worktree.path);
      });
      const nextWorktree = { path: worktree.path, linkedThreads };
      const existingGroup = groupByRoot.get(worktree.workspaceRoot);
      if (existingGroup) {
        existingGroup.worktrees.push(nextWorktree);
      } else {
        const group: WorktreeGroup = {
          workspaceRoot: worktree.workspaceRoot,
          worktrees: [nextWorktree],
        };
        groups.push(group);
        groupByRoot.set(worktree.workspaceRoot, group);
      }
    }
    return groups;
  }, [managedWorktrees, threadShells]);

  const currentGitTextGenerationProvider = settings.textGenerationProvider ?? "opencode";
  const currentGitTextGenerationModel =
    settings.textGenerationModel ?? DEFAULT_GIT_TEXT_GENERATION_MODEL;
  const defaultGitTextGenerationProvider = defaults.textGenerationProvider ?? "opencode";
  const defaultGitTextGenerationModel =
    defaults.textGenerationModel ?? DEFAULT_GIT_TEXT_GENERATION_MODEL;
  const isGitTextGenerationModelDirty =
    currentGitTextGenerationProvider !== defaultGitTextGenerationProvider ||
    currentGitTextGenerationModel !== defaultGitTextGenerationModel;
  const changedSettingLabels = [
    ...(theme !== "system" ? ["主题"] : []),
    ...(!isDefaultActiveTheme ? [`${resolvedTheme === "dark" ? "深色" : "浅色"}主题包`] : []),
    ...(settings.hiddenModels.length > 0 ? ["模型可见性"] : []),
    ...(settings.defaultChatModel.trim() !== defaults.defaultChatModel.trim()
      ? ["默认聊天模型"]
      : []),
    ...(settings.defaultThreadEnvMode !== defaults.defaultThreadEnvMode ? ["默认工作区模式"] : []),
    ...(settings.sidebarProjectSortOrder !== defaults.sidebarProjectSortOrder ? ["项目排序"] : []),
    ...(settings.sidebarThreadSortOrder !== defaults.sidebarThreadSortOrder ? ["会话排序"] : []),
    ...(settings.showChatsSection !== defaults.showChatsSection ? ["聊天分区"] : []),
    ...(settings.showWorkspaceSection !== defaults.showWorkspaceSection ? ["工作区分区"] : []),
    ...(settings.uiDensity !== defaults.uiDensity ? ["界面密度"] : []),
    ...(settings.chatFontSizePx !== defaults.chatFontSizePx ? ["基础字号"] : []),
    ...(settings.terminalFontSizePx !== defaults.terminalFontSizePx ? ["终端字号"] : []),
    ...(settings.terminalFontFamily !== defaults.terminalFontFamily ? ["终端字体"] : []),
    ...(shouldShowFontSmoothing &&
    settings.enableNativeFontSmoothing !== defaults.enableNativeFontSmoothing
      ? ["字体平滑"]
      : []),
    ...(settings.timestampFormat !== defaults.timestampFormat ? ["时间格式"] : []),
    ...(settings.enableTaskCompletionToasts !== defaults.enableTaskCompletionToasts
      ? ["活动 Toast"]
      : []),
    ...(settings.enableSystemTaskCompletionNotifications !==
    defaults.enableSystemTaskCompletionNotifications
      ? ["桌面通知"]
      : []),
    ...(settings.enableAssistantStreaming !== defaults.enableAssistantStreaming
      ? ["助手输出"]
      : []),
    ...(settings.diffWordWrap !== defaults.diffWordWrap ? ["Diff 自动换行"] : []),
    ...(settings.confirmThreadDelete !== defaults.confirmThreadDelete ? ["删除确认"] : []),
    ...(settings.confirmThreadArchive !== defaults.confirmThreadArchive ? ["归档确认"] : []),
    ...(settings.confirmTerminalTabClose !== defaults.confirmTerminalTabClose
      ? ["关闭终端确认"]
      : []),
    ...(isGitTextGenerationModelDirty ? ["版本控制文案模型"] : []),
    ...(settings.customOpenCodeModels.length > 0 ? ["自定义模型"] : []),
  ];

  const openKeybindingsFile = useCallback(() => {
    if (!keybindingsConfigPath) return;
    setOpenKeybindingsError(null);
    setIsOpeningKeybindings(true);
    const api = ensureNativeApi();
    const editor = resolveAndPersistPreferredEditor(availableEditors ?? []);
    if (!editor) {
      setOpenKeybindingsError("未找到可用编辑器。");
      setIsOpeningKeybindings(false);
      return;
    }
    void api.shell
      .openInEditor(keybindingsConfigPath, editor)
      .catch((error) => {
        setOpenKeybindingsError(
          error instanceof Error ? error.message : "无法打开快捷键配置文件。",
        );
      })
      .finally(() => {
        setIsOpeningKeybindings(false);
      });
  }, [availableEditors, keybindingsConfigPath]);

  useEffect(() => {
    setBrowserNotificationPermission(readBrowserNotificationPermissionState());
  }, []);

  async function restoreDefaults() {
    if (changedSettingLabels.length === 0) return;

    const api = readNativeApi();
    const confirmed = await (api ?? ensureNativeApi()).dialogs.confirm(
      ["恢复默认设置？", `将重置：${changedSettingLabels.join("、")}。`].join("\n"),
    );
    if (!confirmed) return;

    setTheme("system");
    resetAllThemes();
    resetSettings();
    setShowRecoveryTools(false);
    setOpenKeybindingsError(null);
  }

  async function setSystemNotificationsEnabled(nextEnabled: boolean) {
    if (!nextEnabled) {
      updateSettings({ enableSystemTaskCompletionNotifications: false });
      return;
    }

    if (isElectron) {
      updateSettings({ enableSystemTaskCompletionNotifications: true });
      return;
    }

    const permission = await requestBrowserNotificationPermission();
    setBrowserNotificationPermission(permission);

    if (permission === "granted") {
      updateSettings({ enableSystemTaskCompletionNotifications: true });
      return;
    }

    updateSettings({ enableSystemTaskCompletionNotifications: false });
    toastManager.add({
      type: permission === "denied" ? "warning" : "error",
      title: "无法启用桌面通知",
      description: buildNotificationSettingsSupportText(permission),
    });
  }

  async function sendTestNotification() {
    const title = "Synara 测试通知";
    const body = "这是一条测试通知，用于确认通知权限是否正常。";

    if (window.desktopBridge) {
      const shown = await window.desktopBridge.notifications.show({ title, body, silent: false });
      toastManager.add({
        type: shown ? "success" : "warning",
        title: shown ? "测试通知已发送" : "通知未显示",
        description: shown ? "系统应已显示该通知。" : "请检查系统通知权限。",
      });
      return;
    }

    const permission = await requestBrowserNotificationPermission();
    setBrowserNotificationPermission(permission);
    if (permission !== "granted") {
      toastManager.add({
        type: permission === "denied" ? "warning" : "error",
        title: "无法发送测试通知",
        description: buildNotificationSettingsSupportText(permission),
      });
      return;
    }

    const notification = new Notification(title, { body, tag: "synara:test-notification" });
    notification.addEventListener("click", () => {
      window.focus();
    });
    toastManager.add({
      type: "success",
      title: "测试通知已发送",
      description: "浏览器应会显示该通知。",
    });
  }

  // Rebuild the local project indexes after an older install leaves them out of sync.
  const repairLocalState = useCallback(async () => {
    if (isRepairingLocalState) {
      return;
    }

    const api = readNativeApi() ?? ensureNativeApi();
    const confirmed = await api.dialogs.confirm(
      ["修复本地状态？", "将重建项目索引，现有会话均保留，可能需要一些时间。"].join("\n"),
    );
    if (!confirmed) {
      return;
    }

    setIsRepairingLocalState(true);
    try {
      const snapshot = await api.orchestration.repairState();
      syncServerReadModel(snapshot);
      toastManager.add({
        type: "success",
        title: "本地状态已修复",
        description: "已重建项目索引，现有会话均保留。",
      });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "修复失败",
        description: error instanceof Error ? error.message : "桌面通知不可用",
      });
    } finally {
      setIsRepairingLocalState(false);
    }
  }, [isRepairingLocalState, syncServerReadModel]);

  const deleteManagedWorktree = useCallback(
    async (input: { workspaceRoot: string; worktreePath: string }) => {
      const api = readNativeApi() ?? ensureNativeApi();
      const displayName = formatWorktreePathForDisplay(input.worktreePath);
      const snapshot = await api.orchestration.getShellSnapshot().catch(() => null);
      if (snapshot === null) {
        toastManager.add({
          type: "error",
          title: "无法验证关联会话",
          description: "请在应用重新连接服务器后重试。",
        });
        return;
      }

      const linkedThreadsFromSnapshot = snapshot.threads.filter((thread) => {
        const candidatePaths = [
          normalizeManagedWorktreePath(thread.worktreePath),
          normalizeManagedWorktreePath(thread.associatedWorktreePath ?? null),
        ];
        return candidatePaths.includes(input.worktreePath);
      });
      const linkedArchivedThreadIds = linkedThreadsFromSnapshot
        .filter((thread) => (thread.archivedAt ?? null) !== null)
        .map((thread) => thread.id);
      const linkedActiveThreadCount = linkedThreadsFromSnapshot.filter(
        (thread) => (thread.archivedAt ?? null) === null,
      ).length;
      const linkedConversationCount = linkedActiveThreadCount + linkedArchivedThreadIds.length;
      const confirmed = await api.dialogs.confirm(
        linkedConversationCount > 0
          ? [
              `删除工作树「${displayName}」？`,
              "",
              `有 ${linkedActiveThreadCount} 个活跃会话和 ${linkedArchivedThreadIds.length} 个已归档会话关联到此工作树。`,
              linkedArchivedThreadIds.length > 0
                ? "已归档会话将先被删除。"
                : "删除后可能影响在同一工作区重新打开这些对话。",
              "",
              "仍要删除该工作树吗？",
            ].join("\n")
          : [`删除工作树「${displayName}」？`, "这将从磁盘移除该 Git 工作树。"].join("\n"),
      );
      if (!confirmed) {
        return;
      }

      try {
        await deleteArchivedThreadsFromClient({
          api: api.orchestration,
          threadIds: linkedArchivedThreadIds,
          removeDeletedThreadFromClientState,
        });

        await removeWorktreeMutation.mutateAsync({
          cwd: input.workspaceRoot,
          path: input.worktreePath,
          force: true,
        });
        await queryClient.invalidateQueries({
          queryKey: serverQueryKeys.worktrees(),
        });
        toastManager.add({
          type: "success",
          title: "工作树已删除",
          description:
            linkedArchivedThreadIds.length > 0
              ? `已移除 ${displayName}，并删除了 ${linkedArchivedThreadIds.length} 个已归档会话。`
              : `已移除 ${displayName}。`,
        });
      } catch (error) {
        toastManager.add({
          type: "error",
          title: "无法删除工作树",
          description: error instanceof Error ? error.message : "删除工作树失败。",
        });
      }
    },
    [queryClient, removeDeletedThreadFromClientState, removeWorktreeMutation],
  );

  const unarchiveThread = useCallback(async (threadId: ThreadId) => {
    const api = readNativeApi();
    if (!api) return;
    try {
      await api.orchestration.dispatchCommand({
        type: "thread.unarchive",
        commandId: newCommandId(),
        threadId,
      });
      toastManager.add({
        type: "success",
        title: "这将重建本地项目索引并刷新项目快照。",
        description: "现有会话会保留，但可能需要一点时间。",
      });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "无法恢复会话",
        description: error instanceof Error ? error.message : "本地状态已修复",
      });
    }
  }, []);

  const deleteArchivedThread = useCallback(
    async (threadId: ThreadId, threadTitle: string) => {
      const api = readNativeApi();
      if (!api) return;

      const confirmed = await api.dialogs.confirm(
        `永久删除「${threadTitle}」？\n\n这将移除该会话及其对话历史，且无法恢复。`,
      );
      if (!confirmed) return;

      try {
        await deleteArchivedThreadFromClient({
          api: api.orchestration,
          threadId,
          removeDeletedThreadFromClientState,
        });
        toastManager.add({
          type: "success",
          title: "会话已删除",
          description: "修复失败",
        });
      } catch (error) {
        toastManager.add({
          type: "error",
          title: "无法删除会话",
          description: error instanceof Error ? error.message : "无法验证已关联的会话",
        });
      }
    },
    [removeDeletedThreadFromClientState],
  );

  const handleArchivedThreadContextMenu = useCallback(
    async (threadId: ThreadId, threadTitle: string, position: { x: number; y: number }) => {
      const api = readNativeApi();
      if (!api) return;

      const clicked = await api.contextMenu.show(
        [
          { id: "restore", label: "恢复" },
          { id: "delete", label: "删除", destructive: true },
        ],
        position,
      );

      if (clicked === "restore") {
        await unarchiveThread(threadId);
        return;
      }

      if (clicked === "delete") {
        await deleteArchivedThread(threadId, threadTitle);
      }
    },
    [deleteArchivedThread, unarchiveThread],
  );

  // Shared on/off settings row: a labelled Switch bound to a boolean AppSettings
  // key, with the standard "reset to default" affordance shown only when changed.
  // Rows with bespoke controls (e.g. the desktop-notifications Test button) keep
  // their own markup instead of using this helper.
  const renderBooleanSettingRow = (config: {
    settingKey: BooleanSettingKey;
    title: string;
    description: string;
    resetLabel: string;
    ariaLabel: string;
  }) => {
    const { settingKey, title, description, resetLabel, ariaLabel } = config;
    const isChanged = settings[settingKey] !== defaults[settingKey];
    return (
      <SettingsRow
        title={title}
        description={description}
        resetAction={
          isChanged ? (
            <SettingResetButton
              label={resetLabel}
              onClick={() =>
                updateSettings({ [settingKey]: defaults[settingKey] } as Partial<AppSettings>)
              }
            />
          ) : null
        }
        control={
          <Switch
            checked={settings[settingKey]}
            onCheckedChange={(checked) =>
              updateSettings({ [settingKey]: Boolean(checked) } as Partial<AppSettings>)
            }
            aria-label={ariaLabel}
          />
        }
      />
    );
  };

  const renderGeneralPanel = () => (
    <div className="space-y-6">
      <SettingsSection title="核心默认">
        <SettingsRow
          title="默认工作区模式"
          description="选择新建草稿会话的默认工作区模式。"
          resetAction={
            settings.defaultThreadEnvMode !== defaults.defaultThreadEnvMode ? (
              <SettingResetButton
                label="默认工作区模式"
                onClick={() =>
                  updateSettings({
                    defaultThreadEnvMode: defaults.defaultThreadEnvMode,
                  })
                }
              />
            ) : null
          }
          control={
            <SettingsSelectControl
              value={settings.defaultThreadEnvMode}
              onValueChange={(value) => {
                if (value !== "local" && value !== "worktree") return;
                updateSettings({
                  defaultThreadEnvMode: value,
                });
              }}
              ariaLabel="默认工作区模式"
              valueContent={settings.defaultThreadEnvMode === "worktree" ? "新建工作树" : "本地"}
            >
              <SelectItem hideIndicator value="local">
                本地
              </SelectItem>
              <SelectItem hideIndicator value="worktree">
                新建工作树
              </SelectItem>
            </SettingsSelectControl>
          }
        />
      </SettingsSection>

      <SettingsSection title="侧边栏组织">
        <SettingsRow
          title="项目排序"
          description="控制主侧边栏中项目的排列方式。"
          resetAction={
            settings.sidebarProjectSortOrder !== defaults.sidebarProjectSortOrder ? (
              <SettingResetButton
                label="项目排序"
                onClick={() =>
                  updateSettings({
                    sidebarProjectSortOrder: defaults.sidebarProjectSortOrder,
                  })
                }
              />
            ) : null
          }
          control={
            <SettingsSelectControl
              value={settings.sidebarProjectSortOrder}
              onValueChange={(value) => {
                if (value !== "updated_at" && value !== "created_at" && value !== "manual") {
                  return;
                }
                updateSettings({ sidebarProjectSortOrder: value });
              }}
              ariaLabel="项目排序"
              valueContent={SIDEBAR_PROJECT_SORT_ORDER_LABELS[settings.sidebarProjectSortOrder]}
            >
              <SelectItem hideIndicator value="updated_at">
                {SIDEBAR_PROJECT_SORT_ORDER_LABELS.updated_at}
              </SelectItem>
              <SelectItem hideIndicator value="created_at">
                {SIDEBAR_PROJECT_SORT_ORDER_LABELS.created_at}
              </SelectItem>
              <SelectItem hideIndicator value="manual">
                {SIDEBAR_PROJECT_SORT_ORDER_LABELS.manual}
              </SelectItem>
            </SettingsSelectControl>
          }
        />

        <SettingsRow
          title="会话排序"
          description="控制每个项目中会话的排列方式。"
          resetAction={
            settings.sidebarThreadSortOrder !== defaults.sidebarThreadSortOrder ? (
              <SettingResetButton
                label="会话排序"
                onClick={() =>
                  updateSettings({
                    sidebarThreadSortOrder: defaults.sidebarThreadSortOrder,
                  })
                }
              />
            ) : null
          }
          control={
            <SettingsSelectControl
              value={settings.sidebarThreadSortOrder}
              onValueChange={(value) => {
                if (value !== "updated_at" && value !== "created_at") {
                  return;
                }
                updateSettings({ sidebarThreadSortOrder: value });
              }}
              ariaLabel="新会话"
              valueContent={SIDEBAR_THREAD_SORT_ORDER_LABELS[settings.sidebarThreadSortOrder]}
            >
              <SelectItem hideIndicator value="updated_at">
                {SIDEBAR_THREAD_SORT_ORDER_LABELS.updated_at}
              </SelectItem>
              <SelectItem hideIndicator value="created_at">
                {SIDEBAR_THREAD_SORT_ORDER_LABELS.created_at}
              </SelectItem>
            </SettingsSelectControl>
          }
        />
      </SettingsSection>

      <SettingsSection title="侧边栏分区">
        {renderBooleanSettingRow({
          settingKey: "showChatsSection",
          title: "会话列表",
          description: "在侧边栏底部显示独立的会话列表（未绑定到项目的会话）。",
          resetLabel: "聊天分区",
          ariaLabel: "在侧边栏显示聊天分区",
        })}

        {renderBooleanSettingRow({
          settingKey: "showWorkspaceSection",
          title: "工作区",
          description: "在侧边栏切换器中显示工作区标签。会话标签始终可见。",
          resetLabel: "工作区分区",
          ariaLabel: "在侧边栏显示工作区分区",
        })}
      </SettingsSection>

      <div ref={environmentPanelRef} id={SETTINGS_TARGETS.environmentPanel}>
        <SettingsSection title="环境面板">
          {renderBooleanSettingRow({
            settingKey: "showEnvironmentRepository",
            title: "仓库",
            description: "在聊天环境面板中显示远程代码仓库链接。源代码变更区域始终可见。",
            resetLabel: "仓库分区",
            ariaLabel: "在环境面板中显示仓库分区",
          })}

          {renderBooleanSettingRow({
            settingKey: "showEnvironmentEditor",
            title: "编辑器",
            description:
              "在聊天环境面板中显示编辑器区块（应用内编辑器视图与「在编辑器中打开」选择器）。",
            resetLabel: "侧边栏分区",
            ariaLabel: "在 环境面板中显示编辑器区块",
          })}

          {renderBooleanSettingRow({
            settingKey: "showEnvironmentRecap",
            title: "回顾",
            description: "在 环境面板中显示自动生成的聊天回顾。",
            resetLabel: "回顾分区",
            ariaLabel: "在 环境面板中显示回顾分区",
          })}

          {renderBooleanSettingRow({
            settingKey: "showEnvironmentPinned",
            title: "置顶消息",
            description: "在 环境面板中显示置顶消息清单。",
            resetLabel: "置顶消息分区",
            ariaLabel: "环境面板",
          })}

          {renderBooleanSettingRow({
            settingKey: "showEnvironmentMarkers",
            title: "文本标记",
            description: "在 环境面板中显示高亮与下划线的对话文本。",
            resetLabel: "用量分区",
            ariaLabel: "在 环境面板中显示文本标记区块",
          })}

          {renderBooleanSettingRow({
            settingKey: "showEnvironmentInstructions",
            title: "项目说明",
            description: "在 环境面板中显示项目级说明。",
            resetLabel: "仓库分区",
            ariaLabel: "在 环境面板中显示项目说明区块",
          })}

          {renderBooleanSettingRow({
            settingKey: "showEnvironmentNotepad",
            title: "记事本",
            description: "在 环境面板中显示每个会话的记事本。",
            resetLabel: "编辑器分区",
            ariaLabel: "在 环境面板中显示记事本区块",
          })}
        </SettingsSection>
      </div>
    </div>
  );

  const renderAppearancePanel = () => (
    <div className="space-y-6">
      <section className={SETTINGS_PANEL_SECTION_CLASS_NAME}>
        <h2 className={SETTINGS_SECTION_LABEL_CLASS_NAME}>主题与字体</h2>
        <SettingsCard>
          <SettingsRow
            title="主题"
            description="选择 Synara 在应用中的外观。"
            resetAction={
              theme !== "system" ? (
                <SettingResetButton label="主题" onClick={() => setTheme("system")} />
              ) : null
            }
            control={
              <SettingsSegmentedControl
                value={theme}
                onValueChange={(value) => {
                  if (value !== "system" && value !== "light" && value !== "dark") return;
                  setTheme(value);
                }}
                ariaLabel="主题偏好"
                options={THEME_OPTIONS}
              />
            }
          />
        </SettingsCard>

        <div className="space-y-3">
          {(resolvedTheme === "dark"
            ? (["dark", "light"] as const)
            : (["light", "dark"] as const)
          ).map((variant) => (
            <ThemePackEditor
              key={variant}
              variant={variant}
              isActive={resolvedTheme === variant}
              mode={theme}
            />
          ))}
        </div>

        <SettingsCard>
          <SettingsRow
            title="界面密度"
            description="控制侧边栏、输入区、聊天边距与设置行的间距，不改变字号。"
            resetAction={
              settings.uiDensity !== defaults.uiDensity ? (
                <SettingResetButton
                  label="界面密度"
                  onClick={() =>
                    updateSettings({
                      uiDensity: DEFAULT_UI_DENSITY,
                    })
                  }
                />
              ) : null
            }
            control={
              <SettingsSegmentedControl
                value={settings.uiDensity}
                onValueChange={(value) => {
                  if (!isUiDensity(value)) {
                    return;
                  }
                  updateSettings({ uiDensity: value });
                }}
                ariaLabel="界面密度"
                options={UI_DENSITY_OPTIONS}
              />
            }
          />

          <SettingsRow
            title="基础字号"
            description="以像素调整应用文字基准。聊天与界面排版将按比例缩放。"
            resetAction={
              settings.chatFontSizePx !== defaults.chatFontSizePx ? (
                <SettingResetButton
                  label="在 环境面板中显示每个会话的记事本。"
                  onClick={() =>
                    updateSettings({
                      chatFontSizePx: defaults.chatFontSizePx,
                    })
                  }
                />
              ) : null
            }
            control={
              <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                <Input
                  type="number"
                  size="sm"
                  min={MIN_CHAT_FONT_SIZE_PX}
                  max={MAX_CHAT_FONT_SIZE_PX}
                  step={1}
                  inputMode="numeric"
                  variant="soft"
                  className="w-full text-right sm:w-20"
                  value={String(settings.chatFontSizePx)}
                  onChange={(event) => {
                    const nextValue = event.target.value.trim();
                    if (nextValue.length === 0) return;
                    updateSettings({
                      chatFontSizePx: normalizeChatFontSizePx(Number(nextValue)),
                    });
                  }}
                  aria-label="主题"
                />
                <span className="text-xs text-muted-foreground">像素</span>
              </div>
            }
          />

          <SettingsRow
            title="终端字号"
            description="独立于应用与聊天字号调整终端文字。"
            resetAction={
              settings.terminalFontSizePx !== defaults.terminalFontSizePx ? (
                <SettingResetButton
                  label="终端字号"
                  onClick={() =>
                    updateSettings({
                      terminalFontSizePx: defaults.terminalFontSizePx,
                    })
                  }
                />
              ) : null
            }
            control={
              <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                <Input
                  type="number"
                  size="sm"
                  min={MIN_TERMINAL_FONT_SIZE_PX}
                  max={MAX_TERMINAL_FONT_SIZE_PX}
                  step={1}
                  inputMode="numeric"
                  variant="soft"
                  className="w-full text-right sm:w-20"
                  value={String(settings.terminalFontSizePx)}
                  onChange={(event) => {
                    const nextValue = event.target.value.trim();
                    if (nextValue.length === 0) return;
                    updateSettings({
                      terminalFontSizePx: normalizeTerminalFontSizePx(Number(nextValue)),
                    });
                  }}
                  aria-label="终端字号（像素）"
                />
                <span className="text-xs text-muted-foreground">像素</span>
              </div>
            }
          />

          <SettingsRow
            title="终端字体"
            description="输入本机已安装的等宽字体名称。留空则使用默认字体；未安装的字体将回退到系统等宽字体。"
            resetAction={
              settings.terminalFontFamily !== defaults.terminalFontFamily ? (
                <SettingResetButton
                  label="终端字体"
                  onClick={() =>
                    updateSettings({
                      terminalFontFamily: defaults.terminalFontFamily,
                    })
                  }
                />
              ) : null
            }
            control={
              <div className="flex w-full items-center justify-end sm:w-auto">
                <Autocomplete
                  items={visibleTerminalFontFamilySuggestions}
                  mode="none"
                  openOnInputClick
                  value={settings.terminalFontFamily}
                  onValueChange={(value) => {
                    updateSettings({
                      terminalFontFamily: normalizeTerminalFontFamily(value),
                    });
                  }}
                >
                  <AutocompleteInput
                    size="sm"
                    variant="soft"
                    showTrigger
                    showClear={settings.terminalFontFamily.length > 0}
                    spellCheck={false}
                    autoComplete="off"
                    placeholder="默认字体"
                    className="w-full sm:w-56"
                    aria-label="终端字体"
                  />
                  <AutocompletePopup className="w-56 min-w-56 font-system-ui">
                    <AutocompleteList>
                      {visibleTerminalFontFamilySuggestions.map((suggestion, index) => (
                        <AutocompleteItem
                          key={suggestion}
                          index={index}
                          value={suggestion}
                          className="font-normal text-[var(--color-text-foreground)]"
                          onClick={() => {
                            updateSettings({
                              terminalFontFamily: normalizeTerminalFontFamily(suggestion),
                            });
                          }}
                        >
                          {suggestion}
                        </AutocompleteItem>
                      ))}
                      <AutocompleteEmpty>无匹配的推荐字体。</AutocompleteEmpty>
                    </AutocompleteList>
                  </AutocompletePopup>
                </Autocomplete>
              </div>
            }
          />

          {shouldShowFontSmoothing
            ? renderBooleanSettingRow({
                settingKey: "enableNativeFontSmoothing",
                title: "字体平滑",
                description: "使用 macOS 风格抗锯齿，使文字更轻、更清晰。",
                resetLabel: "终端字号",
                ariaLabel: "启用字体平滑",
              })
            : null}
        </SettingsCard>
      </section>

      <SettingsSection title="时间与阅读">
        <SettingsRow
          title="时间格式"
          description="系统默认跟随浏览器或操作系统的时钟偏好。"
          resetAction={
            settings.timestampFormat !== defaults.timestampFormat ? (
              <SettingResetButton
                label="时间格式"
                onClick={() =>
                  updateSettings({
                    timestampFormat: defaults.timestampFormat,
                  })
                }
              />
            ) : null
          }
          control={
            <SettingsSelectControl
              value={settings.timestampFormat}
              onValueChange={(value) => {
                if (value !== "locale" && value !== "12-hour" && value !== "24-hour") {
                  return;
                }
                updateSettings({
                  timestampFormat: value,
                });
              }}
              ariaLabel="时间格式"
              triggerClassName="w-full sm:w-40"
              valueContent={TIMESTAMP_FORMAT_LABELS[settings.timestampFormat]}
            >
              <SelectItem hideIndicator value="locale">
                {TIMESTAMP_FORMAT_LABELS.locale}
              </SelectItem>
              <SelectItem hideIndicator value="12-hour">
                {TIMESTAMP_FORMAT_LABELS["12-hour"]}
              </SelectItem>
              <SelectItem hideIndicator value="24-hour">
                {TIMESTAMP_FORMAT_LABELS["24-hour"]}
              </SelectItem>
            </SettingsSelectControl>
          }
        />
      </SettingsSection>
    </div>
  );

  const renderNotificationsPanel = () => (
    <div className="space-y-6">
      <SettingsSection title="活动提醒">
        {renderBooleanSettingRow({
          settingKey: "enableTaskCompletionToasts",
          title: "活动通知",
          description: "当聊天或托管终端代理完成或需要输入时，显示应用内通知。",
          resetLabel: "活动通知",
          ariaLabel: "活动应用内通知",
        })}

        <SettingsRow
          title="桌面通知"
          description="当应用在后台时，若聊天或托管终端代理完成或需要输入，显示系统通知。"
          status={buildNotificationSettingsSupportText(browserNotificationPermission)}
          resetAction={
            settings.enableSystemTaskCompletionNotifications !==
            defaults.enableSystemTaskCompletionNotifications ? (
              <SettingResetButton
                label="字体平滑"
                onClick={() =>
                  updateSettings({
                    enableSystemTaskCompletionNotifications:
                      defaults.enableSystemTaskCompletionNotifications,
                  })
                }
              />
            ) : null
          }
          control={
            <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
              <Button size="xs" variant="outline" onClick={() => void sendTestNotification()}>
                Test
              </Button>
              <Switch
                checked={settings.enableSystemTaskCompletionNotifications}
                onCheckedChange={(checked) => {
                  void setSystemNotificationsEnabled(Boolean(checked));
                }}
                aria-label="系统默认会跟随浏览器或操作系统的时钟偏好。"
              />
            </div>
          }
        />
      </SettingsSection>
    </div>
  );

  const renderBehaviorPanel = () => (
    <div className="space-y-6">
      <SettingsSection title="运行时行为">
        {renderBooleanSettingRow({
          settingKey: "enableAssistantStreaming",
          title: "助手输出",
          description: "在回复进行中逐词元显示输出。",
          resetLabel: "助手输出",
          ariaLabel: "流式显示助手消息",
        })}

        {renderBooleanSettingRow({
          settingKey: "diffWordWrap",
          title: "差异自动换行",
          description: "设置打开差异面板时的默认换行状态。面板内换行开关仅影响当前差异会话。",
          resetLabel: "差异自动换行",
          ariaLabel: "默认换行显示差异",
        })}
      </SettingsSection>

      <SettingsSection title="安全确认">
        {renderBooleanSettingRow({
          settingKey: "confirmThreadDelete",
          title: "删除确认",
          description: "删除会话及其聊天历史前进行确认。",
          resetLabel: "删除确认",
          ariaLabel: "确认删除会话",
        })}

        {renderBooleanSettingRow({
          settingKey: "confirmThreadArchive",
          title: "归档确认",
          description: "归档会话前进行确认。",
          resetLabel: "运行时行为",
          ariaLabel: "确认归档会话",
        })}

        {renderBooleanSettingRow({
          settingKey: "confirmTerminalTabClose",
          title: "关闭终端确认",
          description: "关闭终端标签并清除其历史前进行确认。",
          resetLabel: "关闭终端确认",
          ariaLabel: "确认关闭终端标签",
        })}
      </SettingsSection>
    </div>
  );

  const renderWorktreesPanel = () => (
    <div className="space-y-6">
      <SettingsSection title="托管工作树">
        <div className="space-y-4">
          {serverWorktreesQuery.isLoading ? (
            <div
              className={cn(
                SETTINGS_EMPTY_STATE_CLASS_NAME,
                "px-4 py-6 text-sm text-muted-foreground",
              )}
            >
              正在加载托管工作树…
            </div>
          ) : serverWorktreesQuery.isError ? (
            <div
              className={cn(
                SETTINGS_EMPTY_STATE_CLASS_NAME,
                "border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive",
              )}
            >
              {serverWorktreesQuery.error instanceof Error
                ? serverWorktreesQuery.error.message
                : "无法加载工作树。"}
            </div>
          ) : worktreesByWorkspaceRoot.length === 0 ? (
            <div
              className={cn(
                SETTINGS_EMPTY_STATE_CLASS_NAME,
                "px-4 py-6 text-sm text-muted-foreground",
              )}
            >
              尚未发现应用托管的工作树。
            </div>
          ) : (
            worktreesByWorkspaceRoot.map((group) => (
              <section key={group.workspaceRoot} className="space-y-2">
                <h3 className="px-1 font-mono text-[11px] text-muted-foreground">
                  {group.workspaceRoot}
                </h3>

                <div className={SETTINGS_INSET_LIST_CLASS_NAME}>
                  {group.worktrees.map((worktree, index) => {
                    const deleteDisabled = removeWorktreeMutation.isPending;
                    return (
                      <div
                        key={worktree.path}
                        className={cn(
                          "flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:justify-between",
                          index > 0 && "border-t border-[color:var(--color-border)]",
                        )}
                      >
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="space-y-0.5">
                            <div className="text-sm font-medium text-foreground">工作树</div>
                            <div className="font-mono text-[11px] text-muted-foreground">
                              {worktree.path}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                              关联会话
                            </div>
                            {worktree.linkedThreads.length > 0 ? (
                              <div className="space-y-1">
                                {worktree.linkedThreads.map((thread) => (
                                  <div key={thread.id} className="text-sm text-foreground">
                                    {thread.title}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">
                                此工作树没有关联会话。
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <Button
                            size="xs"
                            variant="destructive"
                            disabled={deleteDisabled}
                            onClick={() =>
                              void deleteManagedWorktree({
                                workspaceRoot: group.workspaceRoot,
                                worktreePath: worktree.path,
                              })
                            }
                          >
                            删除
                          </Button>
                          {worktree.linkedThreads.length > 0 ? (
                            <p className="max-w-40 text-right text-[11px] text-muted-foreground">
                              存在关联会话，删除前会要求确认。
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </SettingsSection>
    </div>
  );

  const renderArchivedPanel = () => {
    const archivedGroups = [
      ...projects.map((project) => ({
        project,
        threads: archivedThreads
          .filter((thread) => thread.projectId === project.id)
          .toSorted((left, right) => {
            const leftKey = left.archivedAt ?? left.updatedAt ?? left.createdAt;
            const rightKey = right.archivedAt ?? right.updatedAt ?? right.createdAt;
            return rightKey.localeCompare(leftKey) || right.id.localeCompare(left.id);
          }),
      })),
      ...(() => {
        const knownProjectIds = new Set(projects.map((project) => project.id));
        const orphanedThreads = archivedThreads
          .filter((thread) => !knownProjectIds.has(thread.projectId))
          .toSorted((left, right) => {
            const leftKey = left.archivedAt ?? left.updatedAt ?? left.createdAt;
            const rightKey = right.archivedAt ?? right.updatedAt ?? right.createdAt;
            return rightKey.localeCompare(leftKey) || right.id.localeCompare(left.id);
          });
        return orphanedThreads.length > 0
          ? [
              {
                project: null,
                threads: orphanedThreads,
              },
            ]
          : [];
      })(),
    ].filter((group) => group.threads.length > 0);

    return (
      <div className="space-y-6">
        {archivedGroups.length === 0 ? (
          <SettingsSection title="已归档会话">
            <div className={cn(SETTINGS_EMPTY_STATE_CLASS_NAME, "px-5 py-10 text-center")}>
              <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full border border-border/70 bg-background/70 text-muted-foreground">
                <ArchiveIcon className="size-5" />
              </div>
              <div className="text-sm font-medium text-foreground">暂无已归档会话</div>
              <div className="mt-1 text-sm text-muted-foreground">
                已归档的会话会显示在这里，可恢复到侧边栏。
              </div>
            </div>
          </SettingsSection>
        ) : (
          archivedGroups.map(({ project, threads: projectThreads }) => (
            <SettingsSection
              key={project?.id ?? "unknown-project"}
              title={project?.name ?? "未知项目"}
            >
              <div className={SETTINGS_INSET_LIST_CLASS_NAME}>
                {projectThreads.map((thread, index) => (
                  <div
                    key={thread.id}
                    className={cn(
                      "flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between",
                      index > 0 && "border-t border-[color:var(--color-border)]",
                    )}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      void handleArchivedThreadContextMenu(thread.id, thread.title, {
                        x: event.clientX,
                        y: event.clientY,
                      });
                    }}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {thread.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Archived {formatRelativeTime(thread.archivedAt ?? thread.createdAt)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => void unarchiveThread(thread.id)}
                      >
                        恢复
                      </Button>
                      <Button
                        size="xs"
                        variant="destructive"
                        onClick={() => void deleteArchivedThread(thread.id, thread.title)}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </SettingsSection>
          ))
        )}
      </div>
    );
  };

  const renderModelsPanel = () => (
    <div className="space-y-8">
      <ModelProvidersSettingsPanel />

      <SettingsSection title="生成默认">
        <DefaultChatModelSettingsRow
          defaultChatModel={settings.defaultChatModel}
          defaultsDefaultChatModel={defaults.defaultChatModel}
          onChange={(slug) => updateSettings({ defaultChatModel: slug })}
          onReset={() => updateSettings({ defaultChatModel: defaults.defaultChatModel })}
        />

        <GitTextGenerationModelSettingsRow
          textGenerationProvider={currentGitTextGenerationProvider}
          textGenerationModel={currentGitTextGenerationModel}
          defaultsTextGenerationProvider={defaultGitTextGenerationProvider}
          defaultsTextGenerationModel={defaultGitTextGenerationModel}
          onChange={(provider, model) =>
            updateSettings({
              textGenerationProvider: provider,
              textGenerationModel: model,
            })
          }
          onReset={() =>
            updateSettings({
              textGenerationProvider: defaults.textGenerationProvider,
              textGenerationModel: defaults.textGenerationModel,
            })
          }
        />
      </SettingsSection>
    </div>
  );

  const renderAdvancedPanel = () => (
    <div className="space-y-6">
      <SettingsSection title="开发者工具">
        <SettingsRow
          title="快捷键"
          description="打开持久化的 `keybindings.json` 文件以直接编辑高级绑定。"
          status={
            <>
              <span className="block break-all font-mono text-[11px] text-foreground">
                {keybindingsConfigPath ?? "正在解析快捷键路径…"}
              </span>
              {openKeybindingsError ? (
                <span className="正在打开…">{openKeybindingsError}</span>
              ) : (
                <span className="打开文件">将在你首选的编辑器中打开。</span>
              )}
            </>
          }
          control={
            <Button
              size="xs"
              variant="outline"
              disabled={!keybindingsConfigPath || isOpeningKeybindings}
              onClick={openKeybindingsFile}
            >
              {isOpeningKeybindings ? "正在打开…" : "打开文件"}
            </Button>
          }
        />

        <SettingsRow
          title="恢复工具"
          description="当本地状态不同步时，重建本地项目索引且不清除现有聊天。"
          status={
            shouldOfferRecoveryTools
              ? "因存在项目但当前无可用聊天历史而显示。"
              : "仅在恢复操作相关时自动显示。"
          }
          control={
            <Button
              size="xs"
              variant="outline"
              disabled={!shouldOfferRecoveryTools || isRepairingLocalState}
              onClick={() => void repairLocalState()}
            >
              {isRepairingLocalState ? "正在修复…" : "修复状态"}
            </Button>
          }
        >
          {shouldOfferRecoveryTools ? (
            <div className="mt-3 border-t border-border/70 pt-3">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => setShowRecoveryTools((current) => !current)}
              >
                <span className="text-xs font-medium text-muted-foreground">功能说明</span>
                <ChevronDownIcon className={cn("版本", showRecoveryTools && "rotate-180")} />
              </button>
              {showRecoveryTools ? (
                <div
                  className={cn(
                    "mt-3 px-3 py-3 text-xs text-muted-foreground",
                    SETTINGS_INSET_LIST_CLASS_NAME,
                  )}
                >
                  重建本地项目索引并刷新项目快照。现有会话会保留。
                </div>
              ) : null}
            </div>
          ) : null}
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="关于">
        <SettingsRow
          title="版本"
          description="当前应用版本。"
          control={<code className="text-xs font-medium text-muted-foreground">{APP_VERSION}</code>}
        />
      </SettingsSection>
    </div>
  );

  const renderActivePanel = () => {
    switch (activeSection) {
      case "general":
        return renderGeneralPanel();
      case "appearance":
        return renderAppearancePanel();
      case "notifications":
        return renderNotificationsPanel();
      case "behavior":
        return renderBehaviorPanel();
      case "shortcuts":
        return <KeyboardShortcutsSettingsPanel />;
      case "worktrees":
        return renderWorktreesPanel();
      case "archived":
        return renderArchivedPanel();
      case "models":
        return renderModelsPanel();
      case "providers":
        return renderModelsPanel();
      case "profile":
        return <ProfileSettingsPanel />;
      case "skills":
        return <SkillsSettingsPanel />;
      case "advanced":
        return renderAdvancedPanel();
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        CHAT_MAIN_VIEWPORT_SHELL_CLASS_NAME,
        SETTINGS_PAGE_BACKGROUND_CLASS_NAME,
        CHAT_CONTENT_CARD_CLASS_NAME,
      )}
    >
      <RouteInsetSurface surfaceClassName={SETTINGS_PAGE_BACKGROUND_CLASS_NAME}>
        {/* Companion sidebar trigger so settings is reachable-and-exitable even when the
          sidebar is collapsed (web/mobile have no global Back arrow). Pinned to the
          card's top-left — at the same header height + traffic-light gutter as the
          chat/workspace headers — so the collapsed-state toggle sits by the traffic
          lights instead of floating in the centered settings body. It renders nothing
          while the sidebar is open (SidebarHeaderNavigationControls returns null), so it
          adds no navigation chrome in the common (open) state and never shifts the centered
          content (hence absolute, not a layout-occupying header row). The strip stays a
          drag-region so the Windows frameless window can be moved by its top edge; the
          caption buttons themselves are a separate fixed cluster (see root route). */}
        <div
          className={cn(
            "drag-region absolute inset-x-0 top-0 z-10 flex items-center",
            CHAT_SURFACE_HEADER_PADDING_X_CLASS,
            CHAT_SURFACE_HEADER_HEIGHT_CLASS,
            desktopTopBarTrafficLightGutterClassName,
          )}
        >
          <div className="pointer-events-auto">
            <SidebarHeaderNavigationControls />
          </div>
        </div>
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto">
            {activeSection === "profile" ? (
              // Profile is a self-contained dashboard: it owns its own header (avatar,
              // name, share) so it skips the section title bar, and gets a slightly wider
              // pane than the form sections to fit the heatmap + two-column layout.
              <div className="mx-auto w-full max-w-3xl px-6 py-8">{renderActivePanel()}</div>
            ) : (
              <div className="mx-auto w-full max-w-2xl px-6 py-8">
                <div className="mb-8 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="text-xl font-medium tracking-tight text-foreground">
                      {activeSectionItem.label}
                    </h1>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {activeSectionItem.description}
                    </p>
                  </div>
                  <Button
                    size="xs"
                    variant="outline"
                    className="shrink-0"
                    disabled={changedSettingLabels.length === 0}
                    onClick={() => void restoreDefaults()}
                  >
                    <RotateCcwIcon className="size-3.5" />
                    恢复默认
                  </Button>
                </div>

                {renderActivePanel()}
              </div>
            )}
          </div>
        </div>
      </RouteInsetSurface>
    </div>
  );
}

export const Route = createFileRoute("/_chat/settings")({
  component: SettingsRouteView,
});
