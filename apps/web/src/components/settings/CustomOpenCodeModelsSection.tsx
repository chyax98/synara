// FILE: CustomOpenCodeModelsSection.tsx
// Purpose: Standalone settings section for adding OpenCode model slugs (providerID/modelID).
// Layer: Settings UI

import { useMemo, useState } from "react";

import { useOpenCodeModelCatalog } from "~/hooks/useOpenCodeModelCatalog";
import { SettingsRow, SettingsSection } from "~/components/settings/SettingsPanelPrimitives";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useCustomOpenCodeModelEditor } from "~/hooks/useCustomOpenCodeModelEditor";
import { PlusIcon, XIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";
import {
  SETTINGS_CARD_ROW_DIVIDER_CLASS_NAME,
  SETTINGS_INSET_LIST_CLASS_NAME,
} from "~/settingsPanelStyles";

export function CustomOpenCodeModelsSection() {
  const catalog = useOpenCodeModelCatalog();
  const editor = useCustomOpenCodeModelEditor({
    onCatalogRefresh: catalog.refreshCatalog,
  });
  const [showAll, setShowAll] = useState(false);

  const savedRows = useMemo(
    () => editor.customModels.map((slug) => ({ key: slug, slug })),
    [editor.customModels],
  );
  const visibleRows = showAll ? savedRows : savedRows.slice(0, 5);

  return (
    <SettingsSection title="自定义模型">
      <SettingsRow
        title="OpenCode 配置中的模型"
        description="通过 SDK config.update 写入 opencode.json（providerID/modelID）。列表来自 config.providers 的 config/custom 来源。"
      >
        <div className={cn("mt-4 pt-4", SETTINGS_CARD_ROW_DIVIDER_CLASS_NAME)}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              id="custom-model-slug"
              size="sm"
              variant="soft"
              value={editor.input}
              onChange={(event) => {
                editor.setInput(event.target.value);
                if (editor.error) {
                  editor.clearError();
                }
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") {
                  return;
                }
                event.preventDefault();
                void editor.addModel();
              }}
              placeholder={editor.example}
              disabled={editor.busy}
              spellCheck={false}
            />
            <Button
              className="shrink-0"
              type="button"
              variant="outline"
              disabled={editor.busy}
              onClick={() => void editor.addModel()}
            >
              <PlusIcon className="size-3.5" />
              添加
            </Button>
          </div>

          {editor.error ? <p className="mt-2 text-xs text-destructive">{editor.error}</p> : null}

          {editor.isLoadingModels ? (
            <p className="mt-2 text-xs text-muted-foreground">正在读取 OpenCode 配置中的模型…</p>
          ) : null}

          {editor.customModels.length > 0 ? (
            <div className={cn("mt-3", SETTINGS_INSET_LIST_CLASS_NAME)}>
              {visibleRows.map((row) => (
                <div
                  key={row.key}
                  className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-[color:var(--color-border)] px-4 py-2 first:border-t-0"
                >
                  <code className="min-w-0 truncate text-sm text-foreground">{row.slug}</code>
                  <button
                    type="button"
                    className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100"
                    aria-label={`移除 ${row.slug}`}
                    onClick={() => void editor.removeModel(row.slug)}
                  >
                    <XIcon className="size-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              ))}

              {savedRows.length > 5 ? (
                <button
                  type="button"
                  className="mt-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setShowAll((value) => !value)}
                >
                  {showAll ? "收起" : `展开更多（${savedRows.length - 5}）`}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </SettingsRow>
    </SettingsSection>
  );
}
