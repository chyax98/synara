// FILE: CustomOpenCodeModelsSection.tsx
// Purpose: Add and manage user-defined OpenCode model slugs (providerID/modelID).
// Layer: Settings UI

import { useCallback, useMemo, useState } from "react";

import {
  MAX_CUSTOM_MODEL_LENGTH,
  MODEL_PROVIDER_SETTINGS,
  getCustomModelsForProvider,
  getDefaultCustomModelsForProvider,
  patchCustomModels,
  useAppSettings,
} from "~/appSettings";
import { SettingResetButton } from "~/components/settings/SettingControls";
import { SettingsRow, SettingsSection } from "~/components/settings/SettingsPanelPrimitives";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { parseOpenCodeModelSlug } from "~/lib/modelCatalogSettings";
import { PlusIcon, XIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";
import {
  SETTINGS_CARD_ROW_DIVIDER_CLASS_NAME,
  SETTINGS_INSET_LIST_CLASS_NAME,
} from "~/settingsPanelStyles";

function normalizeCustomModelInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || !parseOpenCodeModelSlug(trimmed)) {
    return null;
  }
  if (trimmed.length > MAX_CUSTOM_MODEL_LENGTH) {
    return null;
  }
  return trimmed;
}

export function CustomOpenCodeModelsSection() {
  const { settings, updateSettings, defaults } = useAppSettings();
  const providerSettings = MODEL_PROVIDER_SETTINGS[0]!;
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const customModels = getCustomModelsForProvider(settings, "opencode");
  const savedRows = useMemo(
    () => customModels.map((slug) => ({ key: slug, slug })),
    [customModels],
  );
  const visibleRows = showAll ? savedRows : savedRows.slice(0, 5);

  const addModel = useCallback(() => {
    const normalized = normalizeCustomModelInput(input);
    if (!normalized) {
      setError("请输入 providerID/modelID 格式的模型代号（例如 anthropic/claude-sonnet-4）。");
      return;
    }
    if (customModels.includes(normalized)) {
      setError("该模型代号已存在。");
      return;
    }
    updateSettings(patchCustomModels("opencode", [...customModels, normalized]));
    setInput("");
    setError(null);
  }, [customModels, input, updateSettings]);

  const removeModel = useCallback(
    (slug: string) => {
      updateSettings(
        patchCustomModels(
          "opencode",
          customModels.filter((entry) => entry !== slug),
        ),
      );
    },
    [customModels, updateSettings],
  );

  return (
    <SettingsSection title="自定义模型">
      <SettingsRow
        title="手动添加模型"
        description="添加 OpenCode 目录中尚未出现的模型代号（providerID/modelID）。保存后会出现在上方模型列表与输入区选单中。"
        resetAction={
          customModels.length > 0 ? (
            <SettingResetButton
              label="自定义模型"
              onClick={() => {
                updateSettings({
                  customOpenCodeModels: getDefaultCustomModelsForProvider(defaults, "opencode"),
                });
                setError(null);
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
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                if (error) {
                  setError(null);
                }
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") {
                  return;
                }
                event.preventDefault();
                addModel();
              }}
              placeholder={providerSettings.example}
              spellCheck={false}
            />
            <Button className="shrink-0" type="button" variant="outline" onClick={addModel}>
              <PlusIcon className="size-3.5" />
              添加
            </Button>
          </div>

          {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

          {customModels.length > 0 ? (
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
                    onClick={() => removeModel(row.slug)}
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
