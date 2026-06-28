// FILE: DefaultChatModelSettingsRow.tsx
// Purpose: App-level default chat model picker sourced from OpenCode catalog only.
// Layer: Settings UI

import { useMemo } from "react";

import { SettingResetButton, SettingsSelectControl } from "~/components/settings/SettingControls";
import { SettingsRow } from "~/components/settings/SettingsPanelPrimitives";
import { SelectItem } from "~/components/ui/select";
import { useOpenCodeModelCatalog } from "~/hooks/useOpenCodeModelCatalog";
import { resolveOpenCodeDefaultChatModel } from "~/lib/modelCatalogSettings";

export function DefaultChatModelSettingsRow(props: {
  defaultChatModel: string;
  defaultsDefaultChatModel: string;
  onChange: (slug: string) => void;
  onReset: () => void;
}) {
  const catalog = useOpenCodeModelCatalog();
  const isDirty = props.defaultChatModel.trim() !== props.defaultsDefaultChatModel.trim();

  const modelOptions = useMemo(() => {
    if (catalog.visibleOptions.length > 0) {
      return [...catalog.visibleOptions];
    }
    return [...catalog.catalogOptions];
  }, [catalog.catalogOptions, catalog.visibleOptions]);

  const resolvedValue = resolveOpenCodeDefaultChatModel(props.defaultChatModel, modelOptions);

  const selectedLabel =
    modelOptions.find((option) => option.slug === resolvedValue)?.name ??
    (resolvedValue.length > 0 ? resolvedValue : "请先在上方配置模型");

  const description =
    modelOptions.length === 0
      ? "请先在「模型目录」连接提供商并确保有可用模型，再设置新建会话的默认模型。"
      : "新建会话时优先使用的 OpenCode 模型（providerID/modelID）。";

  return (
    <SettingsRow
      title="默认聊天模型"
      description={description}
      resetAction={
        isDirty ? <SettingResetButton label="默认聊天模型" onClick={props.onReset} /> : null
      }
      control={
        modelOptions.length === 0 ? (
          <span className="text-xs text-muted-foreground">暂无可用模型</span>
        ) : (
          <SettingsSelectControl
            value={resolvedValue}
            onValueChange={(value) => {
              if (!value) {
                return;
              }
              props.onChange(value);
            }}
            ariaLabel="默认聊天模型"
            triggerClassName="w-full sm:w-64"
            valueContent={selectedLabel}
          >
            {modelOptions.map((option) => (
              <SelectItem hideIndicator key={option.slug} value={option.slug}>
                {option.name}
                <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                  {option.slug}
                </span>
              </SelectItem>
            ))}
          </SettingsSelectControl>
        )
      }
    />
  );
}
