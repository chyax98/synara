// FILE: ProvidersSettingsSidebar.tsx
// Purpose: Split-layout sidebar for OpenCode providers (OpenChamber-style).
// Layer: Settings UI

import { useMemo } from "react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { useOpenCodeModelCatalog } from "~/hooks/useOpenCodeModelCatalog";
import { SETTINGS_INSET_LIST_CLASS_NAME } from "~/settingsPanelStyles";

export const ADD_PROVIDER_SENTINEL = "__add_provider__";

type Catalog = ReturnType<typeof useOpenCodeModelCatalog>;

export function ProvidersSettingsSidebar(props: {
  catalog: Catalog;
  selectedProviderId: string | null;
  onSelectProvider: (providerId: string) => void;
}) {
  const { catalog, selectedProviderId, onSelectProvider } = props;

  const connectedGroups = useMemo(
    () => catalog.sidebarGroups.filter((group) => catalog.connectedProviderIds.has(group.id)),
    [catalog.connectedProviderIds, catalog.sidebarGroups],
  );

  const configuredOnlyGroups = catalog.configuredOnlyProviders;
  const discoverableGroups = catalog.discoverableUnconnectedProviders;

  return (
    <aside className="w-full shrink-0 lg:w-56">
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          提供商
        </h3>
        <Button
          type="button"
          size="xs"
          variant="outline"
          className="!font-normal"
          onClick={() => onSelectProvider(ADD_PROVIDER_SENTINEL)}
        >
          添加
        </Button>
      </div>

      <div className={cn(SETTINGS_INSET_LIST_CLASS_NAME, "overflow-hidden")}>
        {connectedGroups.length === 0 &&
        configuredOnlyGroups.length === 0 &&
        discoverableGroups.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">暂无已发现提供商。</p>
        ) : null}

        {connectedGroups.length > 0 ? (
          <section>
            <div className="border-b border-[color:var(--color-border)] px-3 py-2 text-[11px] font-medium text-muted-foreground">
              已连接
            </div>
            {connectedGroups.map((group, index) => (
              <button
                key={group.id}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors",
                  index > 0 && "border-t border-[color:var(--color-border)]",
                  selectedProviderId === group.id
                    ? "bg-[color:var(--color-surface-muted)] text-foreground"
                    : "text-foreground hover:bg-[color:var(--color-surface-muted)]/60",
                )}
                onClick={() => onSelectProvider(group.id)}
              >
                <span className="min-w-0 truncate font-medium">{group.name}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {group.models.length}
                </span>
              </button>
            ))}
          </section>
        ) : null}

        {configuredOnlyGroups.length > 0 ? (
          <section>
            <div className="border-b border-t border-[color:var(--color-border)] px-3 py-2 text-[11px] font-medium text-muted-foreground">
              已配置
            </div>
            {configuredOnlyGroups.map((group, index) => (
              <button
                key={group.id}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors",
                  index > 0 && "border-t border-[color:var(--color-border)]",
                  selectedProviderId === group.id
                    ? "bg-[color:var(--color-surface-muted)] text-foreground"
                    : "text-foreground hover:bg-[color:var(--color-surface-muted)]/60",
                )}
                onClick={() => onSelectProvider(group.id)}
              >
                <span className="min-w-0 truncate font-medium">{group.name}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {group.models.length}
                </span>
              </button>
            ))}
          </section>
        ) : null}

        {discoverableGroups.length > 0 ? (
          <section>
            <div className="border-b border-t border-[color:var(--color-border)] px-3 py-2 text-[11px] font-medium text-muted-foreground">
              可连接
            </div>
            {discoverableGroups.map((group, index) => (
              <button
                key={group.id}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors",
                  index > 0 && "border-t border-[color:var(--color-border)]",
                  selectedProviderId === group.id
                    ? "bg-[color:var(--color-surface-muted)] text-foreground"
                    : "text-muted-foreground hover:bg-[color:var(--color-surface-muted)]/60 hover:text-foreground",
                )}
                onClick={() => onSelectProvider(group.id)}
              >
                <span className="min-w-0 truncate">{group.name}</span>
              </button>
            ))}
          </section>
        ) : null}
      </div>
    </aside>
  );
}
