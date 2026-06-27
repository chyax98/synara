import type { ResolvedThreadWorkspaceState } from "@t3tools/shared/threadEnvironment";
import type { ProviderInteractionMode } from "@t3tools/contracts";
import type { DraftThreadEnvMode } from "../../composerDraftStore";
import {
  type ContextWindowSnapshot,
  formatContextWindowTokens,
  formatCostUsd,
} from "../../lib/contextWindow";
import type { RateLimitStatus } from "./RateLimitBanner";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { ContextWindowMeter } from "./ContextWindowMeter";

function formatRateLimitMessage(rateLimitStatus: RateLimitStatus): string {
  const resetSuffix = rateLimitStatus.resetsAt
    ? ` 将于 ${new Date(rateLimitStatus.resetsAt).toLocaleTimeString()} 重置。`
    : "";
  if (rateLimitStatus.status === "rejected") {
    return `已达到速率限制。${resetSuffix}`;
  }
  const utilizationSuffix =
    typeof rateLimitStatus.utilization === "number"
      ? `（已用 ${Math.round(rateLimitStatus.utilization * 100)}%）`
      : "";
  return `接近速率限制${utilizationSuffix}。${resetSuffix}`;
}

function formatEnvironmentLabel(
  envMode: DraftThreadEnvMode,
  envState: ResolvedThreadWorkspaceState,
): string {
  if (envMode === "local") {
    return "本地";
  }
  return envState === "worktree-pending" ? "新工作树（待创建）" : "工作树";
}

export function ComposerSlashStatusDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedModel: string | null | undefined;
  fastModeEnabled: boolean;
  selectedPromptEffort: string | null;
  interactionMode: ProviderInteractionMode;
  envMode: DraftThreadEnvMode;
  envState: ResolvedThreadWorkspaceState;
  branch: string | null;
  contextWindow: ContextWindowSnapshot | null;
  cumulativeCostUsd: number | null;
  rateLimitStatus: RateLimitStatus | null;
  activeContextWindowLabel?: string | null;
  pendingContextWindowLabel?: string | null;
}) {
  const {
    open,
    onOpenChange,
    selectedModel,
    fastModeEnabled,
    selectedPromptEffort,
    interactionMode,
    envMode,
    envState,
    branch,
    contextWindow,
    cumulativeCostUsd,
    rateLimitStatus,
    activeContextWindowLabel,
    pendingContextWindowLabel,
  } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-xl">
        <DialogHeader>
          <DialogTitle>会话状态</DialogTitle>
          <DialogDescription>当前输入框的运行时控制项与会话本地状态。</DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          <div className="grid gap-3 rounded-lg border border-border/60 bg-muted/20 p-4 text-sm sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">模型</p>
              <p className="font-medium text-foreground">{selectedModel}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">快速模式</p>
              <p className="font-medium text-foreground">{fastModeEnabled ? "开" : "关"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">推理</p>
              <p className="font-medium text-foreground">{selectedPromptEffort ?? "默认"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">模式</p>
              <p className="font-medium text-foreground">
                {interactionMode === "plan" ? "计划" : "默认"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">环境</p>
              <p className="font-medium text-foreground">
                {formatEnvironmentLabel(envMode, envState)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">分支</p>
              <p className="font-medium text-foreground">{branch ?? "未知"}</p>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border/60 bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  上下文窗口
                </p>
                <p className="text-sm text-muted-foreground">当前会话报告的最新用量。</p>
                {pendingContextWindowLabel ? (
                  <p className="text-sm text-muted-foreground">
                    当前会话：{activeContextWindowLabel ?? "未知"}。下一轮：
                    {pendingContextWindowLabel}。
                  </p>
                ) : null}
              </div>
              {contextWindow ? (
                <ContextWindowMeter
                  usage={contextWindow}
                  cumulativeCostUsd={cumulativeCostUsd}
                  activeWindowLabel={activeContextWindowLabel}
                  pendingWindowLabel={pendingContextWindowLabel}
                />
              ) : null}
            </div>
            {contextWindow ? (
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">已用</p>
                  <p className="font-medium text-foreground">
                    {formatContextWindowTokens(contextWindow.usedTokens)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">剩余</p>
                  <p className="font-medium text-foreground">
                    {formatContextWindowTokens(contextWindow.remainingTokens)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">窗口</p>
                  <p className="font-medium text-foreground">
                    {formatContextWindowTokens(contextWindow.maxTokens)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">费用</p>
                  <p className="font-medium text-foreground">
                    {cumulativeCostUsd !== null ? formatCostUsd(cumulativeCostUsd) : "不可用"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">此会话尚未报告上下文用量。</p>
            )}
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 bg-card p-4">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">速率限制</p>
            {rateLimitStatus ? (
              <p className="text-sm text-foreground">{formatRateLimitMessage(rateLimitStatus)}</p>
            ) : (
              <p className="text-sm text-muted-foreground">此会话当前没有速率限制警告。</p>
            )}
          </div>
        </DialogPanel>
        <DialogFooter variant="bare">
          <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
