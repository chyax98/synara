// FILE: ModelProvidersSettingsPanel.tsx
// Purpose: OpenCode provider connection, custom models, and per-model visibility (Synara settings style).
// Layer: Settings UI

import { useMemo } from "react";

import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { OpenCodeRuntimeSettingsRows } from "~/components/settings/OpenCodeRuntimeSettingsRows";
import { ProviderAuthSettingsPanel } from "~/components/settings/ProviderAuthSettingsPanel";
import { SettingsRow, SettingsSection } from "~/components/settings/SettingsPanelPrimitives";
import { useOpenCodeModelCatalog } from "~/hooks/useOpenCodeModelCatalog";
import {
  isModelSlugHidden,
  parseOpenCodeModelSlug,
  providerGroupVisibleCount,
  setModelsVisibilityBySlugs,
  toggleHiddenModelRef,
} from "~/lib/modelCatalogSettings";

export function ModelProvidersSettingsPanel() {
  const catalog = useOpenCodeModelCatalog();
  const { settings, updateSettings } = catalog;

  const connectedGroups = useMemo(
    () => catalog.sidebarGroups.filter((group) => catalog.connectedProviderIds.has(group.id)),
    [catalog.connectedProviderIds, catalog.sidebarGroups],
  );

  const setModelVisible = (slug: string, visible: boolean) => {
    const ref = parseOpenCodeModelSlug(slug);
    if (!ref) {
      return;
    }
    updateSettings({
      hiddenModels: toggleHiddenModelRef(settings.hiddenModels, ref, visible),
    });
  };

  const setProviderModelsVisible = (providerId: string, visible: boolean) => {
    const group = catalog.resolveGroup(providerId);
    if (!group) {
      return;
    }
    updateSettings({
      hiddenModels: setModelsVisibilityBySlugs(
        settings.hiddenModels,
        group.models.map((model) => model.slug),
        visible,
      ),
    });
  };

  const runtimeSettings = (
    <SettingsSection title="OpenCode 连接">
      <OpenCodeRuntimeSettingsRows />
    </SettingsSection>
  );

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
          description="请检查上方 OpenCode 可执行文件路径是否正确。你仍可在「自定义模型」区手动添加模型代号。"
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
              onClick={() => void catalog.refreshCatalog()}
            >
              重试
            </Button>
          }
        />
      );
    }

    if (catalog.catalogOptions.length === 0) {
      return (
        <SettingsRow
          title="暂无已发现模型"
          description="连接下方上游提供商可同步模型目录；也可在上方「自定义模型」直接添加 providerID/modelID。"
        />
      );
    }

    return (
      <SettingsRow
        title="OpenCode 模型源"
        description="显示本机 OpenCode 已发现的模型。开启可见后才能在输入区与默认聊天模型等处选用。"
        control={
          <span className="text-xs font-medium text-muted-foreground">
            {catalog.isDiscoveryPending
              ? "正在同步…"
              : `${catalog.visibleOptions.length} / ${catalog.catalogOptions.length} 可选`}
          </span>
        }
      />
    );
  })();

  return (
    <div className="space-y-8">
      {runtimeSettings}

      <SettingsSection title="模型目录">{catalogStatusRow}</SettingsSection>

      {connectedGroups.map((group) => {
        const counts = providerGroupVisibleCount(group, settings.hiddenModels);
        const authMethods = catalog.authMethodsByProvider[group.id] ?? [];
        return (
          <SettingsSection key={group.id} title={group.name}>
            <SettingsRow
              title="连接与认证"
              description={
                catalog.connectedProviderIds.has(group.id)
                  ? "已连接。断开后需重新认证才能使用此提供商的模型。"
                  : "未连接。完成认证后模型才会出现在列表中。"
              }
            >
              <ProviderAuthSettingsPanel
                variant="inline"
                providerId={group.id}
                providerName={group.name}
                connected={catalog.connectedProviderIds.has(group.id)}
                connection={catalog.connection}
                authMethods={authMethods}
                onAuthChanged={catalog.refreshCatalog}
              />
            </SettingsRow>

            <SettingsRow
              title="模型可见性"
              description={`${counts.visible} / ${counts.total} 个模型在选单中可见`}
              control={
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => setProviderModelsVisible(group.id, true)}
                  >
                    全部显示
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => setProviderModelsVisible(group.id, false)}
                  >
                    全部隐藏
                  </Button>
                </div>
              }
            />

            {group.models.length === 0 ? (
              <SettingsRow
                title="暂无模型"
                description="OpenCode 尚未返回此提供商的模型。请确认提供商已正确连接。"
              />
            ) : (
              group.models.map((model) => {
                const visible = !isModelSlugHidden(model.slug, settings.hiddenModels);
                return (
                  <SettingsRow
                    key={model.slug}
                    title={model.name}
                    description={model.slug}
                    control={
                      <Switch
                        checked={visible}
                        onCheckedChange={(checked) => setModelVisible(model.slug, Boolean(checked))}
                        aria-label={`${model.name} 在选单中可见`}
                      />
                    }
                  />
                );
              })
            )}
          </SettingsSection>
        );
      })}

      {catalog.unconnectedProviders.length > 0 ? (
        <SettingsSection title="连接更多提供商">
          {catalog.unconnectedProviders.map((provider) => (
            <SettingsRow key={provider.id} title={provider.name} description={provider.id}>
              <ProviderAuthSettingsPanel
                variant="inline"
                providerId={provider.id}
                providerName={provider.name}
                connected={false}
                connection={catalog.connection}
                authMethods={catalog.authMethodsByProvider[provider.id] ?? []}
                onAuthChanged={catalog.refreshCatalog}
              />
            </SettingsRow>
          ))}
        </SettingsSection>
      ) : null}
    </div>
  );
}
