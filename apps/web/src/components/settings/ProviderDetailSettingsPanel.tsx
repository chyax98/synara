// FILE: ProviderDetailSettingsPanel.tsx
// Purpose: Per-provider auth, config provenance, and model curation detail pane.
// Layer: Settings UI

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { ProviderAuthSettingsPanel } from "~/components/settings/ProviderAuthSettingsPanel";
import { ProviderConfigRemoveControls } from "~/components/settings/ProviderConfigRemoveControls";
import { SettingsRow, SettingsSection } from "~/components/settings/SettingsPanelPrimitives";
import type { useOpenCodeModelCatalog } from "~/hooks/useOpenCodeModelCatalog";
import { openCodeProviderConfigSourcesQueryOptions } from "~/lib/openCodeCatalogReactQuery";
import {
  formatOpenCodeProviderConfigSources,
  primaryOpenCodeProviderConfigPath,
} from "~/lib/openCodeProviderSources";
import {
  isModelSlugHidden,
  parseOpenCodeModelSlug,
  providerGroupVisibleCount,
  setModelsVisibilityBySlugs,
} from "~/lib/modelCatalogSettings";
import { maybeRefreshOpenCodeCatalog } from "~/lib/openCodeCatalogReload";
import { toggleModelVisibility } from "~/lib/settingsUxMutations";
import { favoriteModelSlugSet, toggleFavoriteModelSlug } from "~/lib/modelPrefs";
import { cn } from "~/lib/utils";
import { StarIcon } from "~/lib/icons";

type Catalog = ReturnType<typeof useOpenCodeModelCatalog>;

export function ProviderDetailSettingsPanel(props: { catalog: Catalog; providerId: string }) {
  const { catalog, providerId } = props;
  const group = catalog.resolveGroup(providerId);
  const [modelQuery, setModelQuery] = useState("");
  const { settings, updateSettings } = catalog;

  const sourcesQuery = useQuery(
    openCodeProviderConfigSourcesQueryOptions({
      binaryPath: catalog.connection.binaryPath,
      serverUrl: catalog.connection.serverUrl,
      serverPassword: catalog.connection.serverPassword,
      cwd: null,
      providerID: providerId,
      enabled: Boolean(providerId),
    }),
  );

  const favoriteSlugs = useMemo(
    () => favoriteModelSlugSet(settings.favoriteModels),
    [settings.favoriteModels],
  );

  if (!group) {
    return (
      <SettingsRow
        title="未找到提供商"
        description="请从左侧列表重新选择，或刷新 OpenCode 配置后重试。"
      />
    );
  }

  const connected = catalog.connectedProviderIds.has(providerId);
  const authMethods = catalog.authMethodsByProvider[providerId] ?? [];
  const counts = providerGroupVisibleCount(group, settings.hiddenModels);
  const sourcesLabel = sourcesQuery.data
    ? formatOpenCodeProviderConfigSources(sourcesQuery.data)
    : null;
  const sourcesPath = sourcesQuery.data
    ? primaryOpenCodeProviderConfigPath(sourcesQuery.data)
    : null;

  const filteredModels = group.models.filter((model) => {
    const query = modelQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return model.name.toLowerCase().includes(query) || model.slug.toLowerCase().includes(query);
  });

  const setModelVisible = (slug: string, visible: boolean) => {
    const ref = parseOpenCodeModelSlug(slug);
    if (!ref) {
      return;
    }
    updateSettings({
      hiddenModels: toggleModelVisibility(settings, ref, visible).hiddenModels,
    });
  };

  const setProviderModelsVisible = (visible: boolean) => {
    updateSettings({
      hiddenModels: setModelsVisibilityBySlugs(
        settings.hiddenModels,
        group.models.map((model) => model.slug),
        visible,
      ),
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-medium tracking-tight text-foreground">{group.name}</h2>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{group.id}</p>
      </div>

      <SettingsSection title="连接与认证">
        <SettingsRow
          title="认证状态"
          description={
            connected
              ? "已连接。更新凭据或完成 OAuth 后建议重新加载 OpenCode 配置。"
              : "未连接。完成认证后模型才会可用于推理。"
          }
        >
          <ProviderAuthSettingsPanel
            variant="inline"
            providerId={group.id}
            providerName={group.name}
            connected={connected}
            connection={catalog.connection}
            authMethods={authMethods}
            onAuthChanged={async () => {
              await maybeRefreshOpenCodeCatalog(
                settings.openCodeAutoReloadCatalog,
                catalog.refreshCatalog,
              );
            }}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="配置来源">
        <SettingsRow
          title="OpenCode 配置层"
          description={
            sourcesLabel
              ? `配置于：${sourcesLabel}`
              : sourcesQuery.isLoading
                ? "正在读取本机 OpenCode 配置文件…"
                : "未发现此提供商的持久化配置条目（可能仅通过环境变量或运行时认证）。"
          }
          status={
            sourcesPath ? (
              <code className="block break-all text-[11px] text-muted-foreground">
                {sourcesPath}
              </code>
            ) : null
          }
        >
          {sourcesQuery.data ? (
            <ProviderConfigRemoveControls
              providerId={group.id}
              connection={catalog.connection}
              configSources={sourcesQuery.data}
              onRemoved={async () => {
                await maybeRefreshOpenCodeCatalog(
                  settings.openCodeAutoReloadCatalog,
                  catalog.refreshCatalog,
                );
                await sourcesQuery.refetch();
              }}
            />
          ) : null}
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="模型">
        <SettingsRow
          title="可见性"
          description={`${counts.visible} / ${counts.total} 个模型在选单中可见`}
          control={
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => setProviderModelsVisible(true)}
              >
                全部显示
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => setProviderModelsVisible(false)}
              >
                全部隐藏
              </Button>
            </div>
          }
        />

        <div className="px-1 pb-2">
          <Input
            value={modelQuery}
            onChange={(event) => setModelQuery(event.target.value)}
            placeholder="筛选模型…"
            className="h-8"
            aria-label="筛选模型"
          />
        </div>

        {filteredModels.length === 0 ? (
          <SettingsRow
            title="暂无匹配模型"
            description={
              group.models.length === 0
                ? "OpenCode 尚未返回此提供商的模型。"
                : "尝试调整筛选关键词。"
            }
          />
        ) : (
          filteredModels.map((model) => {
            const visible = !isModelSlugHidden(model.slug, settings.hiddenModels);
            const isFavorite = favoriteSlugs.has(model.slug);
            return (
              <SettingsRow
                key={model.slug}
                title={model.name}
                description={model.slug}
                control={
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={cn(
                        "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-surface-muted)] hover:text-foreground",
                        isFavorite && "text-[color:var(--color-accent)]",
                      )}
                      aria-label={isFavorite ? "取消收藏" : "收藏模型"}
                      onClick={() =>
                        updateSettings({
                          favoriteModels: toggleFavoriteModelSlug(
                            settings.favoriteModels,
                            model.slug,
                          ),
                        })
                      }
                    >
                      <StarIcon className={cn("size-3.5", isFavorite && "fill-current")} />
                    </button>
                    <Switch
                      checked={visible}
                      onCheckedChange={(checked) => setModelVisible(model.slug, Boolean(checked))}
                      aria-label={`${model.name} 在选单中可见`}
                    />
                  </div>
                }
              />
            );
          })
        )}
      </SettingsSection>
    </div>
  );
}
