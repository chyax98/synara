// FILE: ProvidersSettingsLayout.tsx
// Purpose: OpenChamber-style split providers settings (sidebar + detail + connection).
// Layer: Settings UI

import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import { CustomOpenCodeModelsSection } from "~/components/settings/CustomOpenCodeModelsSection";
import { CustomOpenCodeProviderPanel } from "~/components/settings/CustomOpenCodeProviderPanel";
import { OpenCodeRuntimeSettingsRows } from "~/components/settings/OpenCodeRuntimeSettingsRows";
import { ProviderDetailSettingsPanel } from "~/components/settings/ProviderDetailSettingsPanel";
import {
  ADD_PROVIDER_SENTINEL,
  ProvidersSettingsSidebar,
} from "~/components/settings/ProvidersSettingsSidebar";
import { SettingsRow, SettingsSection } from "~/components/settings/SettingsPanelPrimitives";
import { ProviderAuthSettingsPanel } from "~/components/settings/ProviderAuthSettingsPanel";
import { useOpenCodeModelCatalog } from "~/hooks/useOpenCodeModelCatalog";
import { useAppSettings } from "~/appSettings";
import { maybeRefreshOpenCodeCatalog } from "~/lib/openCodeCatalogReload";
import { RotateCcwIcon } from "~/lib/icons";
import { Switch } from "~/components/ui/switch";

export function ProvidersSettingsLayout() {
  const { settings, updateSettings } = useAppSettings();
  const catalog = useOpenCodeModelCatalog();
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [isReloading, setIsReloading] = useState(false);

  const defaultProviderId =
    catalog.sidebarGroups.find((group) => catalog.connectedProviderIds.has(group.id))?.id ??
    catalog.configuredOnlyProviders[0]?.id ??
    catalog.sidebarGroups[0]?.id ??
    catalog.discoverableUnconnectedProviders[0]?.id ??
    null;

  useEffect(() => {
    if (selectedProviderId !== null) {
      return;
    }
    if (defaultProviderId) {
      setSelectedProviderId(defaultProviderId);
    }
  }, [defaultProviderId, selectedProviderId]);

  const maybeRefreshCatalog = async () => {
    await maybeRefreshOpenCodeCatalog(settings.openCodeAutoReloadCatalog, catalog.refreshCatalog);
  };

  const reloadOpenCode = async () => {
    setIsReloading(true);
    try {
      await catalog.refreshCatalog();
    } finally {
      setIsReloading(false);
    }
  };

  const catalogStatusRow = (() => {
    if (catalog.isLoading) {
      return (
        <SettingsRow
          title="正在加载模型目录"
          description="正在通过 OpenCode SDK 拉取提供商与模型列表。"
        />
      );
    }

    if (catalog.isError) {
      return (
        <SettingsRow
          title="无法加载模型目录"
          description="请检查 OpenCode 可执行文件路径。你仍可在「自定义模型」区手动添加模型代号。"
          status={
            catalog.errorMessage ? (
              <code className="block break-all text-[11px] text-destructive">
                {catalog.errorMessage}
              </code>
            ) : null
          }
          control={
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => void reloadOpenCode()}
              disabled={isReloading}
            >
              重试
            </Button>
          }
        />
      );
    }

    return (
      <SettingsRow
        title="OpenCode 模型源"
        description="显示本机 OpenCode 已发现的模型。连接提供商或编辑 opencode.json 后请重新加载配置。"
        control={
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {catalog.isDiscoveryPending
                ? "正在同步…"
                : `${catalog.visibleOptions.length} / ${catalog.catalogOptions.length} 可选`}
            </span>
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={isReloading}
              onClick={() => void reloadOpenCode()}
            >
              <RotateCcwIcon className="size-3.5" />
              {isReloading ? "加载中…" : "重新加载"}
            </Button>
          </div>
        }
      />
    );
  })();

  const isAddMode = selectedProviderId === ADD_PROVIDER_SENTINEL;
  const addTarget = catalog.discoverableUnconnectedProviders[0] ?? null;

  return (
    <div className="space-y-8">
      <CustomOpenCodeModelsSection />

      <SettingsSection title="自定义提供商">
        <CustomOpenCodeProviderPanel onSaved={maybeRefreshCatalog} />
      </SettingsSection>

      <SettingsSection title="OpenCode 连接">
        <OpenCodeRuntimeSettingsRows />
      </SettingsSection>

      <SettingsSection title="模型目录">
        {catalogStatusRow}
        <SettingsRow
          title="认证后自动重新加载"
          description="连接、断开、写入 opencode.json 或增删自定义模型后自动刷新目录。关闭后需手动点「重新加载」。"
          control={
            <Switch
              checked={settings.openCodeAutoReloadCatalog}
              onCheckedChange={(checked) =>
                updateSettings({ openCodeAutoReloadCatalog: Boolean(checked) })
              }
              aria-label="认证后自动重新加载 OpenCode 目录"
            />
          }
        />
        <SettingsRow
          title="助手输出传输"
          description="streaming = 实时流式渲染（极客/低延迟）；buffered = 整段完成后一次性显示。"
          control={
            <Switch
              checked={settings.enableAssistantStreaming}
              onCheckedChange={(checked) =>
                updateSettings({ enableAssistantStreaming: Boolean(checked) })
              }
              aria-label="启用流式助手输出"
            />
          }
        />
      </SettingsSection>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <ProvidersSettingsSidebar
          catalog={catalog}
          selectedProviderId={selectedProviderId}
          onSelectProvider={setSelectedProviderId}
        />

        <div className="min-w-0 flex-1">
          {isAddMode ? (
            addTarget ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-medium tracking-tight text-foreground">连接提供商</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    从左侧「可连接」列表选择提供商，或先在下方连接一个常用上游。
                  </p>
                </div>
                <SettingsSection title={addTarget.name}>
                  <SettingsRow title="认证" description={addTarget.id}>
                    <ProviderAuthSettingsPanel
                      variant="inline"
                      providerId={addTarget.id}
                      providerName={addTarget.name}
                      connected={false}
                      connection={catalog.connection}
                      authMethods={catalog.authMethodsByProvider[addTarget.id] ?? []}
                      onAuthChanged={async () => {
                        await maybeRefreshCatalog();
                        setSelectedProviderId(addTarget.id);
                      }}
                    />
                  </SettingsRow>
                </SettingsSection>
              </div>
            ) : (
              <SettingsRow
                title="全部提供商已连接"
                description="当前 OpenCode 目录中的提供商均已完成认证。"
              />
            )
          ) : selectedProviderId ? (
            <ProviderDetailSettingsPanel catalog={catalog} providerId={selectedProviderId} />
          ) : (
            <SettingsRow title="选择提供商" description="从左侧列表选择一个提供商查看详情。" />
          )}
        </div>
      </div>
    </div>
  );
}
