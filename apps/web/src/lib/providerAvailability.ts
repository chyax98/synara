import {
  PROVIDER_DISPLAY_NAMES,
  type ProviderKind,
  type ServerProviderStatus,
} from "@t3tools/contracts";

const PROVIDER_RUNTIME_STATUS = {
  ready: "ready",
  warning: "warning",
} as const;

export interface ProviderSendAvailability {
  readonly provider: ProviderKind;
  readonly status: ServerProviderStatus | null;
  readonly usable: boolean;
  readonly unavailableReason: string;
}

export function normalizeCustomBinaryPath(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeProviderStatusForLocalConfig(input: {
  provider: ProviderKind;
  status: ServerProviderStatus | null | undefined;
  customBinaryPath?: string | null | undefined;
  confirmedCustomBinaryPath?: string | null | undefined;
}): ServerProviderStatus | null {
  const status = input.status ?? null;
  if (!status) {
    return null;
  }

  const customBinaryPath = normalizeCustomBinaryPath(input.customBinaryPath);
  if (!customBinaryPath) {
    return status;
  }

  if (status.available || status.authStatus !== "unknown") {
    return status;
  }

  if (normalizeCustomBinaryPath(input.confirmedCustomBinaryPath) === customBinaryPath) {
    // Only the exact path used by a successful session can suppress the warning.
    return {
      provider: status.provider,
      available: true,
      status: PROVIDER_RUNTIME_STATUS.ready,
      authStatus: status.authStatus,
      checkedAt: status.checkedAt,
      ...(status.authType ? { authType: status.authType } : {}),
      ...(status.authLabel ? { authLabel: status.authLabel } : {}),
      ...(status.voiceTranscriptionAvailable !== undefined
        ? { voiceTranscriptionAvailable: status.voiceTranscriptionAvailable }
        : {}),
    };
  }

  return {
    ...status,
    available: true,
    status: PROVIDER_RUNTIME_STATUS.warning,
    message: `${PROVIDER_DISPLAY_NAMES[input.provider]} 在本应用中使用了自定义本地二进制路径。启动会话后将确认可用性。`,
  };
}

export function isProviderUsable(status: ServerProviderStatus | null | undefined): boolean {
  if (!status) {
    // Missing status means the health check has not confirmed an installed provider yet.
    return false;
  }
  return status.available && status.authStatus !== "unauthenticated";
}

export function providerUnavailableReason(status: ServerProviderStatus | null | undefined): string {
  if (!status) {
    return "提供商状态仍在加载中。";
  }
  const providerLabel = PROVIDER_DISPLAY_NAMES[status.provider] ?? status.provider;
  if (status.authStatus === "unauthenticated") {
    return `${providerLabel} 尚未完成认证。`;
  }
  if (!status.available) {
    return status.message ?? `${providerLabel} 当前不可用。`;
  }
  return status.message ?? `${providerLabel} 当前可用性受限。`;
}

export function findProviderStatus(
  statuses: readonly ServerProviderStatus[],
  provider: ProviderKind,
): ServerProviderStatus | null {
  return statuses.find((status) => status.provider === provider) ?? null;
}

// Shared send gate used by chat, Kanban, shortcuts, and handoff flows.
export function resolveProviderSendAvailability(input: {
  readonly provider: ProviderKind;
  readonly statuses: readonly ServerProviderStatus[];
}): ProviderSendAvailability {
  const status = findProviderStatus(input.statuses, input.provider);
  return {
    provider: input.provider,
    status,
    usable: isProviderUsable(status),
    unavailableReason: providerUnavailableReason(status),
  };
}
