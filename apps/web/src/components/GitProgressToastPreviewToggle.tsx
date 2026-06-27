// FILE: GitProgressToastPreviewToggle.tsx
// Purpose: Expose a sidebar switch for keeping the git progress toast pinned during styling work.
// Exports: GitProgressToastPreviewToggle

import { LoaderCircleIcon } from "~/lib/icons";

import { setFeatureFlagEnabled, useFeatureFlags } from "../featureFlags";
import { SidebarMenuButton } from "./ui/sidebar";
import { cn } from "~/lib/utils";

export function GitProgressToastPreviewToggle() {
  const featureFlags = useFeatureFlags();
  const enabled = featureFlags["pin-git-progress-toast-preview"];

  return (
    <SidebarMenuButton
      size="default"
      aria-pressed={enabled}
      className={cn(
        "h-8 flex-1 gap-2.5 rounded-lg px-2 text-[length:var(--app-font-size-ui,12px)] font-normal hover:bg-[var(--sidebar-accent)]",
        enabled ? "text-foreground" : "text-muted-foreground/72 hover:text-muted-foreground/88",
      )}
      onClick={() => {
        setFeatureFlagEnabled("pin-git-progress-toast-preview", !enabled);
      }}
      title="保持循环显示的 Git 进度提示，便于调整样式"
    >
      <LoaderCircleIcon className={cn("size-[15px]", enabled && "animate-spin")} />
      <span>{enabled ? "Git 提示预览已开启" : "Git 提示预览"}</span>
    </SidebarMenuButton>
  );
}
