// FILE: CustomOpenCodeModelsSection.tsx
// Purpose: Standalone settings section for adding OpenCode model slugs (providerID/modelID).
// Layer: Settings UI

import { useMemo, useState } from "react";

import { getDefaultCustomModelsForProvider, useAppSettings } from "~/appSettings";
import { SettingResetButton } from "~/components/settings/SettingControls";
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
  const { defaults, updateSettings } = useAppSettings();
  const editor = useCustomOpenCodeModelEditor();
  const [showAll, setShowAll] = useState(false);

  const savedRows = useMemo(
    () => editor.customModels.map((slug) => ({ key: slug, slug })),
    [editor.customModels],
  );
  const visibleRows = showAll ? savedRows : savedRows.slice(0, 5);

  return (
    <SettingsSection title="自定义模型">
      <SettingsRow
        title="已保存模型代号"
        description="手动添加 OpenCode 目录中尚未出现的模型（providerID/modelID）。无需先连接下方提供商，保存后即可在输入区选单中使用。"
        resetAction={
          editor.customModels.length > 0 ? (
            <SettingResetButton
              label="自定义模型"
              onClick={() => {
                updateSettings({
                  customOpenCodeModels: getDefaultCustomModelsForProvider(defaults, "opencode"),
                });
                editor.setInput("");
                editor.clearError();
                setShowAll(false);
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
                editor.addModel();
              }}
              placeholder={editor.example}
              spellCheck={false}
            />
            <Button
              className="shrink-0"
              type="button"
              variant="outline"
              onClick={() => editor.addModel()}
            >
              <PlusIcon className="size-3.5" />
              添加
            </Button>
          </div>

          {editor.error ? <p className="mt-2 text-xs text-destructive">{editor.error}</p> : null}

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
                    onClick={() => editor.removeModel(row.slug)}
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
