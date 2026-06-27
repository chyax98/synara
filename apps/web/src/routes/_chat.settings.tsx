// FILE: _chat.settings.tsx
// Purpose: Render the dedicated settings experience with its own section sidebar and grouped panels.
// Layer: Route screen
// Exports: Settings route component for `/settings`

import {
  PROVIDER_DISPLAY_NAMES,
  type ProviderKind,
  type ThreadId,
  DEFAULT_GIT_TEXT_GENERATION_MODEL,
} from "@t3tools/contracts";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getModelOptions, normalizeModelSlug } from "@t3tools/shared/model";
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type AppSettings,
  DEFAULT_UI_DENSITY,
  type UiDensity,
  MAX_CHAT_FONT_SIZE_PX,
  MAX_TERMINAL_FONT_SIZE_PX,
  getCustomModelsForProvider,
  getGitTextGenerationModelOptions,
  MAX_CUSTOM_MODEL_LENGTH,
  MIN_CHAT_FONT_SIZE_PX,
  MIN_TERMINAL_FONT_SIZE_PX,
  MODEL_PROVIDER_SETTINGS,
  normalizeChatFontSizePx,
  normalizeTerminalFontFamily,
  normalizeTerminalFontSizePx,
  patchCustomModels,
  TERMINAL_FONT_FAMILY_SUGGESTIONS,
  useAppSettings,
} from "../appSettings";
import { APP_VERSION } from "../branding";
import { useDesktopTopBarTrafficLightGutterClassName } from "../hooks/useDesktopTopBarGutter";
import { ProviderOptionLabel } from "../components/ProviderIcon";
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
import { SkillsSettingsPanel } from "../components/settings/SkillsSettingsPanel";
import {
  CHAT_CONTENT_CARD_CLASS_NAME,
  CHAT_MAIN_VIEWPORT_SHELL_CLASS_NAME,
  CHAT_ROUTE_INSET_SHELL_CLASS_NAME,
} from "../components/chat/composerPickerStyles";
import {
  CHAT_SURFACE_HEADER_HEIGHT_CLASS,
  CHAT_SURFACE_HEADER_PADDING_X_CLASS,
} from "../components/chat/chatHeaderControls";
import { SidebarHeaderNavigationControls } from "../components/SidebarHeaderNavigationControls";
import { SidebarInset } from "../components/ui/sidebar";
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
  PlusIcon,
  RotateCcwIcon,
  SunIcon,
  XIcon,
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
  SETTINGS_CARD_ROW_DIVIDER_CLASS_NAME,
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

const PROVIDER_SELECT_OPTIONS = ["opencode"] as const satisfies readonly ProviderKind[];

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

const CUSTOM_MODEL_PROVIDER: ProviderKind = "opencode";

// ── Settings UI primitives ────────────────────────────────────────────────

// Shared settings controls live in ~/components/settings/SettingControls.

function isProviderSelectOption(value: string): value is ProviderKind {
  return PROVIDER_SELECT_OPTIONS.includes(value as ProviderKind);
}

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
  const [releaseHistoryOpen, setReleaseHistoryOpen] = useState(false);
  const [openKeybindingsError, setOpenKeybindingsError] = useState<string | null>(null);
  const environmentPanelRef = useRef<HTMLDivElement | null>(null);
  const [customModelInput, setCustomModelInput] = useState("");
  const [customModelErrorByProvider, setCustomModelErrorByProvider] = useState<
    Partial<Record<ProviderKind, string | null>>
  >({});
  const [showAllCustomModels, setShowAllCustomModels] = useState(false);
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

  // Builds provider model-option arrays; only the Models panel reads it. Memoize on the
  // narrow inputs the helper actually uses (destructured so exhaustive-deps stays exact) so
  // typing in any other settings field — every keystroke re-renders this monolithic route —
  // doesn't rebuild these lists.
  const { customOpenCodeModels, textGenerationModel, textGenerationProvider } = settings;
  const gitTextGenerationModelOptions = useMemo(
    () =>
      getGitTextGenerationModelOptions({
        customOpenCodeModels,
        textGenerationModel,
        textGenerationProvider,
      }),
    [customOpenCodeModels, textGenerationModel, textGenerationProvider],
  );
  const currentGitTextGenerationProvider = settings.textGenerationProvider ?? "opencode";
  const currentGitTextGenerationModel =
    settings.textGenerationModel ?? DEFAULT_GIT_TEXT_GENERATION_MODEL;
  const currentGitTextGenerationValue = `${currentGitTextGenerationProvider}:${currentGitTextGenerationModel}`;
  const defaultGitTextGenerationProvider = defaults.textGenerationProvider ?? "opencode";
  const defaultGitTextGenerationModel =
    defaults.textGenerationModel ?? DEFAULT_GIT_TEXT_GENERATION_MODEL;
  const isGitTextGenerationModelDirty =
    currentGitTextGenerationProvider !== defaultGitTextGenerationProvider ||
    currentGitTextGenerationModel !== defaultGitTextGenerationModel;
  const selectedGitTextGenerationModelLabel =
    gitTextGenerationModelOptions.find(
      (option) =>
        option.provider === currentGitTextGenerationProvider &&
        option.slug === currentGitTextGenerationModel,
    )?.name ?? currentGitTextGenerationModel;
  const selectedCustomModelProviderSettings = MODEL_PROVIDER_SETTINGS.find(
    (providerSettings) => providerSettings.provider === CUSTOM_MODEL_PROVIDER,
  )!;
  const selectedCustomModelError = customModelErrorByProvider[CUSTOM_MODEL_PROVIDER] ?? null;
  const totalCustomModels =
    settings.customCodexModels.length +
    settings.customClaudeModels.length +
    settings.customCursorModels.length +
    settings.customGeminiModels.length +
    settings.customGrokModels.length +
    settings.customKiloModels.length +
    settings.customOpenCodeModels.length +
    settings.customPiModels.length;
  const savedCustomModelRows = useMemo(
    () =>
      MODEL_PROVIDER_SETTINGS.flatMap((providerSettings) =>
        getCustomModelsForProvider(settings, providerSettings.provider).map((slug) => ({
          key: `${providerSettings.provider}:${slug}`,
          provider: providerSettings.provider,
          providerTitle: providerSettings.title,
          slug,
        })),
      ),
    [settings],
  );
  const visibleCustomModelRows = showAllCustomModels
    ? savedCustomModelRows
    : savedCustomModelRows.slice(0, 5);
  const changedSettingLabels = [
    ...(theme !== "system" ? ["主题"] : []),
    ...(!isDefaultActiveTheme ? [`${resolvedTheme === "dark" ? "深色" : "浅色"}主题包`] : []),
    ...(settings.defaultProvider !== defaults.defaultProvider ? ["默认 Provider"] : []),
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
    ...(settings.enableComposerSuggestions !== defaults.enableComposerSuggestions
      ? ["提示建议"]
      : []),
    ...(settings.confirmThreadDelete !== defaults.confirmThreadDelete ? ["删除确认"] : []),
    ...(settings.confirmThreadArchive !== defaults.confirmThreadArchive ? ["归档确认"] : []),
    ...(settings.confirmTerminalTabClose !== defaults.confirmTerminalTabClose
      ? ["关闭终端确认"]
      : []),
    ...(isGitTextGenerationModelDirty ? ["Git 文案模型"] : []),
    ...(settings.customCodexModels.length > 0 ||
    settings.customClaudeModels.length > 0 ||
    settings.customCursorModels.length > 0 ||
    settings.customGeminiModels.length > 0 ||
    settings.customGrokModels.length > 0 ||
    settings.customKiloModels.length > 0 ||
    settings.customOpenCodeModels.length > 0 ||
    settings.customPiModels.length > 0
      ? ["自定义模型"]
      : []),
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

  const addCustomModel = useCallback(
    (provider: ProviderKind) => {
      const customModels = getCustomModelsForProvider(settings, provider);
      const normalized = normalizeModelSlug(customModelInput, provider);
      if (!normalized) {
        setCustomModelErrorByProvider((existing) => ({
          ...existing,
          [provider]: "深色",
        }));
        return;
      }
      if (getModelOptions(provider).some((option) => option.slug === normalized)) {
        setCustomModelErrorByProvider((existing) => ({
          ...existing,
          [provider]: "浅色",
        }));
        return;
      }
      if (normalized.length > MAX_CUSTOM_MODEL_LENGTH) {
        setCustomModelErrorByProvider((existing) => ({
          ...existing,
          [provider]: `Model slugs must be ${MAX_CUSTOM_MODEL_LENGTH} characters or less.`,
        }));
        return;
      }
      if (customModels.includes(normalized)) {
        setCustomModelErrorByProvider((existing) => ({
          ...existing,
          [provider]: "默认 provider",
        }));
        return;
      }

      updateSettings(patchCustomModels(provider, [...customModels, normalized]));
      setCustomModelInput("");
      setCustomModelErrorByProvider((existing) => ({
        ...existing,
        [provider]: null,
      }));
    },
    [customModelInput, settings, updateSettings],
  );

  const removeCustomModel = useCallback(
    (provider: ProviderKind, slug: string) => {
      const customModels = getCustomModelsForProvider(settings, provider);
      updateSettings(
        patchCustomModels(
          provider,
          customModels.filter((model) => model !== slug),
        ),
      );
      setCustomModelErrorByProvider((existing) => ({
        ...existing,
        [provider]: null,
      }));
    },
    [settings, updateSettings],
  );

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
    setCustomModelInput("");
    setCustomModelErrorByProvider({});
    setShowAllCustomModels(false);
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
        `Permanently delete "${threadTitle}"?\n\nThis will remove the thread and its conversation history forever.`,
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
          title="默认 Provider"
          description="新会话使用 OpenCode。"
          resetAction={
            settings.defaultProvider !== defaults.defaultProvider ? (
              <SettingResetButton
                label="默认 Provider"
                onClick={() => updateSettings({ defaultProvider: defaults.defaultProvider })}
              />
            ) : null
          }
          control={
            <SettingsSelectControl
              value={settings.defaultProvider}
              onValueChange={(value) => {
                if (!isProviderSelectOption(value)) return;
                updateSettings({ defaultProvider: value });
              }}
              ariaLabel="默认 Provider"
              valueContent={
                <ProviderOptionLabel
                  provider={settings.defaultProvider}
                  label={PROVIDER_DISPLAY_NAMES[settings.defaultProvider]}
                />
              }
            >
              {PROVIDER_SELECT_OPTIONS.map((provider) => (
                <SelectItem hideIndicator key={provider} value={provider}>
                  <ProviderOptionLabel
                    provider={provider}
                    label={PROVIDER_DISPLAY_NAMES[provider]}
                  />
                </SelectItem>
              ))}
            </SettingsSelectControl>
          }
        />

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
              ariaLabel="Project sort order"
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
          resetLabel: "chats section",
          ariaLabel: "Show the Chats section in the sidebar",
        })}

        {renderBooleanSettingRow({
          settingKey: "showWorkspaceSection",
          title: "工作区",
          description: "在侧边栏切换器中显示工作区标签。Threads 标签始终可见。",
          resetLabel: "项目排序",
          ariaLabel: "Show the Workspace section in the sidebar",
        })}
      </SettingsSection>

      <div ref={environmentPanelRef} id={SETTINGS_TARGETS.environmentPanel}>
        <SettingsSection title="Environment 面板">
          {renderBooleanSettingRow({
            settingKey: "showEnvironmentRepository",
            title: "仓库",
            description:
              "在 chat Environment 面板中显示 GitHub 仓库链接。git 区块（Changes、Worktree、branch、Commit and Push）始终可见。",
            resetLabel: "repository section",
            ariaLabel: "Show the Repository section in the Environment panel",
          })}

          {renderBooleanSettingRow({
            settingKey: "showEnvironmentEditor",
            title: "编辑器",
            description:
              "在 chat Environment 面板中显示编辑器区块（应用内编辑器视图与「在编辑器中打开」选择器）。",
            resetLabel: "侧边栏分区",
            ariaLabel: "Show the Editor section in the Environment panel",
          })}

          {renderBooleanSettingRow({
            settingKey: "showEnvironmentRecap",
            title: "回顾",
            description: "在 Environment 面板中显示自动生成的聊天回顾。",
            resetLabel: "recap section",
            ariaLabel: "Show the Recap section in the Environment panel",
          })}

          {renderBooleanSettingRow({
            settingKey: "showEnvironmentPinned",
            title: "置顶消息",
            description: "在 Environment 面板中显示置顶消息清单。",
            resetLabel: "pinned messages section",
            ariaLabel: "Environment 面板",
          })}

          {renderBooleanSettingRow({
            settingKey: "showEnvironmentMarkers",
            title: "文本标记",
            description: "在 Environment 面板中显示高亮与下划线的对话文本。",
            resetLabel: "用量分区",
            ariaLabel: "Show the Text markers section in the Environment panel",
          })}

          {renderBooleanSettingRow({
            settingKey: "showEnvironmentInstructions",
            title: "项目说明",
            description: "在 Environment 面板中显示项目级说明。",
            resetLabel: "仓库分区",
            ariaLabel: "Show the Project instructions section in the Environment panel",
          })}

          {renderBooleanSettingRow({
            settingKey: "showEnvironmentNotepad",
            title: "记事本",
            description: "在 Environment 面板中显示每个会话的记事本。",
            resetLabel: "编辑器分区",
            ariaLabel: "Show the Notepad section in the Environment panel",
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
                <SettingResetButton label="theme" onClick={() => setTheme("system")} />
              ) : null
            }
            control={
              <SettingsSegmentedControl
                value={theme}
                onValueChange={(value) => {
                  if (value !== "system" && value !== "light" && value !== "dark") return;
                  setTheme(value);
                }}
                ariaLabel="Theme preference"
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
                  label="在 Environment 面板中显示每个会话的记事本。"
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
                <span className="text-xs text-muted-foreground">px</span>
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
                  aria-label="Terminal font size in pixels"
                />
                <span className="text-xs text-muted-foreground">px</span>
              </div>
            }
          />

          <SettingsRow
            title="Terminal 字体"
            description="输入本机已安装的等宽字体（如 Fira Code）。留空则使用默认字体；未安装的字体将回退到系统等宽字体。"
            resetAction={
              settings.terminalFontFamily !== defaults.terminalFontFamily ? (
                <SettingResetButton
                  label="terminal font"
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
                    placeholder="默认（JetBrains Mono）"
                    className="w-full sm:w-56"
                    aria-label="Terminal font family"
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
                      <AutocompleteEmpty>No matching suggested fonts.</AutocompleteEmpty>
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
                resetLabel: "terminal 字号",
                ariaLabel: "Enable font smoothing",
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
                label="time format"
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
          title: "活动 Toast",
          description: "当聊天或托管终端代理完成或需要输入时，显示应用内 Toast。",
          resetLabel: "activity toasts",
          ariaLabel: "Activity toast notifications",
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
          description: "在回复进行中逐 token 显示输出。",
          resetLabel: "assistant output",
          ariaLabel: "Stream assistant messages",
        })}

        {renderBooleanSettingRow({
          settingKey: "diffWordWrap",
          title: "Diff 自动换行",
          description: "设置打开 diff 面板时的默认换行状态。面板内换行开关仅影响当前 diff 会话。",
          resetLabel: "diff line wrapping",
          ariaLabel: "Wrap diff lines by default",
        })}

        {renderBooleanSettingRow({
          settingKey: "enableComposerSuggestions",
          title: "提示建议",
          description: "新建会话时在输入框下方显示建议提示。",
          resetLabel: "当 chat 或托管 terminal agent 完成或需要输入时，显示应用内通知。",
          ariaLabel: "活动通知",
        })}
      </SettingsSection>

      <SettingsSection title="安全确认">
        {renderBooleanSettingRow({
          settingKey: "confirmThreadDelete",
          title: "删除确认",
          description: "删除会话及其聊天历史前进行确认。",
          resetLabel: "delete confirmation",
          ariaLabel: "Confirm thread deletion",
        })}

        {renderBooleanSettingRow({
          settingKey: "confirmThreadArchive",
          title: "归档确认",
          description: "归档会话前进行确认。",
          resetLabel: "运行时行为",
          ariaLabel: "Confirm thread archive",
        })}

        {renderBooleanSettingRow({
          settingKey: "confirmTerminalTabClose",
          title: "关闭终端确认",
          description: "关闭终端标签并清除其历史前进行确认。",
          resetLabel: "terminal close confirmation",
          ariaLabel: "Confirm terminal tab close",
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
    <div className="space-y-6">
      <SettingsSection title="生成默认">
        <SettingsRow
          title="Git 文案模型"
          description="用于生成提交说明、PR 标题与分支名。"
          resetAction={
            isGitTextGenerationModelDirty ? (
              <SettingResetButton
                label="git writing model"
                onClick={() =>
                  updateSettings({
                    textGenerationProvider: defaults.textGenerationProvider,
                    textGenerationModel: defaults.textGenerationModel,
                  })
                }
              />
            ) : null
          }
          control={
            <SettingsSelectControl
              value={currentGitTextGenerationValue}
              onValueChange={(value) => {
                if (!value) return;
                const separatorIndex = value.indexOf(":");
                const provider = value.slice(0, separatorIndex) as ProviderKind;
                const model = value.slice(separatorIndex + 1);
                if (!provider || !model) return;
                updateSettings({
                  textGenerationProvider: provider,
                  textGenerationModel: model,
                });
              }}
              ariaLabel="Git text generation model"
              triggerClassName="w-full sm:w-52"
              valueContent={selectedGitTextGenerationModelLabel}
            >
              {gitTextGenerationModelOptions.map((option) => (
                <SelectItem
                  hideIndicator
                  key={`${option.provider}:${option.slug}`}
                  value={`${option.provider}:${option.slug}`}
                >
                  {PROVIDER_DISPLAY_NAMES[option.provider]} / {option.name}
                </SelectItem>
              ))}
            </SettingsSelectControl>
          }
        />
      </SettingsSection>

      <SettingsSection title="自定义模型">
        <SettingsRow
          title="已保存 model 代号"
          description="为支持的 provider 添加自定义 model 代号。"
          resetAction={
            totalCustomModels > 0 ? (
              <SettingResetButton
                label="custom models"
                onClick={() => {
                  updateSettings({
                    customCodexModels: defaults.customCodexModels,
                    customClaudeModels: defaults.customClaudeModels,
                    customCursorModels: defaults.customCursorModels,
                    customGeminiModels: defaults.customGeminiModels,
                    customGrokModels: defaults.customGrokModels,
                    customKiloModels: defaults.customKiloModels,
                    customOpenCodeModels: defaults.customOpenCodeModels,
                    customPiModels: defaults.customPiModels,
                  });
                  setCustomModelErrorByProvider({});
                  setShowAllCustomModels(false);
                }}
              />
            ) : null
          }
        >
          <div className={cn("mt-4 pt-4", SETTINGS_CARD_ROW_DIVIDER_CLASS_NAME)}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                id="custom-model-slug"
                size="sm"
                variant="soft"
                value={customModelInput}
                onChange={(event) => {
                  const value = event.target.value;
                  setCustomModelInput(value);
                  if (selectedCustomModelError) {
                    setCustomModelErrorByProvider((existing) => ({
                      ...existing,
                      [CUSTOM_MODEL_PROVIDER]: null,
                    }));
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  addCustomModel(CUSTOM_MODEL_PROVIDER);
                }}
                placeholder={selectedCustomModelProviderSettings.example}
                spellCheck={false}
              />
              <Button
                className="shrink-0"
                variant="outline"
                onClick={() => addCustomModel(CUSTOM_MODEL_PROVIDER)}
              >
                <PlusIcon className="size-3.5" />
                添加
              </Button>
            </div>

            {selectedCustomModelError ? (
              <p className="mt-2 text-xs text-destructive">{selectedCustomModelError}</p>
            ) : null}

            {totalCustomModels > 0 ? (
              <div className={cn("mt-3", SETTINGS_INSET_LIST_CLASS_NAME)}>
                {visibleCustomModelRows.map((row) => (
                  <div
                    key={row.key}
                    className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-[color:var(--color-border)] px-4 py-2 first:border-t-0"
                  >
                    <code className="min-w-0 truncate text-sm text-foreground">{row.slug}</code>
                    <button
                      type="button"
                      className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100"
                      aria-label={`移除 ${row.slug}`}
                      onClick={() => removeCustomModel(row.provider, row.slug)}
                    >
                      <XIcon className="size-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                ))}

                {savedCustomModelRows.length > 5 ? (
                  <button
                    type="button"
                    className="mt-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setShowAllCustomModels((value) => !value)}
                  >
                    {showAllCustomModels
                      ? "收起"
                      : `展开更多（${savedCustomModelRows.length - 5}）`}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </SettingsRow>
      </SettingsSection>
    </div>
  );

  const renderProvidersPanel = () => (
    <div className="space-y-6">
      <SettingsSection title="Provider">
        <SettingsRow
          title="OpenCode"
          description="Synara 仅支持 OpenCode 作为唯一 Provider，无需额外配置。"
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
                <span className="打开文件">Opens in your preferred editor.</span>
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
                <span className="text-xs font-medium text-muted-foreground">What this does</span>
                <ChevronDownIcon className={cn("版本", showRecoveryTools && "rotate-180")} />
              </button>
              {showRecoveryTools ? (
                <div
                  className={cn(
                    "mt-3 px-3 py-3 text-xs text-muted-foreground",
                    SETTINGS_INSET_LIST_CLASS_NAME,
                  )}
                >
                  Rebuilds local project indexes and refreshes project snapshots. Existing chats
                  stay in place.
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
        <SettingsRow
          title="发布历史"
          description="按时间倒序记录每次更新。与更新后对话框相同的说明，可随时在此查看。"
          control={
            <Button size="sm" variant="outline" onClick={() => setReleaseHistoryOpen(true)}>
              View release history
            </Button>
          }
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
      case "worktrees":
        return renderWorktreesPanel();
      case "archived":
        return renderArchivedPanel();
      case "models":
        return renderModelsPanel();
      case "providers":
        return renderProvidersPanel();
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
      <SidebarInset
        className={CHAT_ROUTE_INSET_SHELL_CLASS_NAME}
        surfaceClassName={SETTINGS_PAGE_BACKGROUND_CLASS_NAME}
      >
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
        {/* Mounted at the route level (outside the scrollable panel) so the
          dialog portal can overlay the entire settings view without being
          clipped by the content wrapper's overflow. */}
      </SidebarInset>
    </div>
  );
}

export const Route = createFileRoute("/_chat/settings")({
  component: SettingsRouteView,
});
