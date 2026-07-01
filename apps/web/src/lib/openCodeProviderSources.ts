// FILE: openCodeProviderSources.ts
// Purpose: Format OpenCode provider config provenance for settings UI.
// Layer: Web settings helpers

import type {
  OpenCodeProviderConfigSources,
  OpenCodeProviderDisconnectScope,
} from "@t3tools/contracts";

export function formatOpenCodeProviderConfigSources(
  sources: OpenCodeProviderConfigSources,
): string | null {
  const labels: string[] = [];
  if (sources.auth.exists) {
    labels.push("认证凭据");
  }
  if (sources.user.exists) {
    labels.push("用户配置");
  }
  if (sources.project.exists) {
    labels.push("项目配置");
  }
  if (sources.custom.exists) {
    labels.push("自定义配置");
  }
  return labels.length > 0 ? labels.join("、") : null;
}

export function primaryOpenCodeProviderConfigPath(
  sources: OpenCodeProviderConfigSources,
): string | null {
  if (sources.project.exists && sources.project.path) {
    return sources.project.path;
  }
  if (sources.custom.exists && sources.custom.path) {
    return sources.custom.path;
  }
  if (sources.user.exists && sources.user.path) {
    return sources.user.path;
  }
  if (sources.auth.exists && sources.auth.path) {
    return sources.auth.path;
  }
  return null;
}

export function resolveDisconnectScopeOptions(
  sources: OpenCodeProviderConfigSources,
): ReadonlyArray<{ value: OpenCodeProviderDisconnectScope; label: string }> {
  const options: Array<{ value: OpenCodeProviderDisconnectScope; label: string }> = [
    { value: "all", label: "全部层（认证 + 配置）" },
  ];
  if (sources.auth.exists) {
    options.push({ value: "auth", label: "仅认证凭据" });
  }
  if (sources.user.exists) {
    options.push({ value: "user", label: "用户配置" });
  }
  if (sources.project.exists) {
    options.push({ value: "project", label: "项目配置" });
  }
  if (sources.custom.exists) {
    options.push({ value: "custom", label: "OPENCODE_CONFIG" });
  }
  return options;
}

export function hasProviderConfigLayer(sources: OpenCodeProviderConfigSources): boolean {
  return (
    sources.auth.exists || sources.user.exists || sources.project.exists || sources.custom.exists
  );
}
