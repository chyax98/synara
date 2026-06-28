// FILE: GitTextGenerationModelSettingsRow.tsx
// Purpose: Git commit/PR text model picker sourced from OpenCode catalog only.
// Layer: Settings UI

import { useMemo } from "react";

import { SettingResetButton, SettingsSelectControl } from "~/components/settings/SettingControls";
import { SettingsRow } from "~/components/settings/SettingsPanelPrimitives";
import { SelectItem } from "~/components/ui/select";
import { useOpenCodeModelCatalog } from "~/hooks/useOpenCodeModelCatalog";
import { resolveOpenCodeDefaultChatModel } from "~/lib/modelCatalogSettings";
import type { ProviderKind } from "@t3tools/contracts";

export function GitTextGenerationModelSettingsRow(props: {
  textGenerationProvider: ProviderKind;
  textGenerationModel: string;
  defaultsTextGenerationProvider: ProviderKind;
  defaultsTextGenerationModel: string;
  onChange: (provider: ProviderKind, model: string) => void;
  onReset: () => void;
}) {
  const catalog = useOpenCodeModelCatalog();
  const isDirty =
    props.textGenerationProvider !== props.defaultsTextGenerationProvider ||
    props.textGenerationModel !== props.defaultsTextGenerationModel;

  const modelOptions = useMemo(() => {
    const options =
      catalog.visibleOptions.length > 0 ? catalog.visibleOptions : catalog.catalogOptions;
    const configured = props.textGenerationModel.trim();
    if (
      configured &&
      !options.some((option) => option.slug === configured) &&
      catalog.catalogOptions.some((option) => option.slug === configured)
    ) {
      const hidden = catalog.catalogOptions.find((option) => option.slug === configured);
      return hidden ? [hidden, ...options] : options;
    }
    return [...options];
  }, [catalog.catalogOptions, catalog.visibleOptions, props.textGenerationModel]);

  const resolvedModel = resolveOpenCodeDefaultChatModel(props.textGenerationModel, modelOptions);
  const currentValue =
    resolvedModel.length > 0 ? `${props.textGenerationProvider}:${resolvedModel}` : undefined;

  const selectedLabel =
    modelOptions.find((option) => option.slug === resolvedModel)?.name ??
    (resolvedModel.length > 0 ? resolvedModel : "请先在上方配置模型");

  return (
    <SettingsRow
      title="版本控制文案模型"
      description={
        modelOptions.length === 0
          ? "请先在「模型目录」连接提供商并确保有可用模型。"
          : "用于生成提交说明、合并请求标题与分支名。"
      }
      resetAction={
        isDirty ? <SettingResetButton label="版本控制文案模型" onClick={props.onReset} /> : null
      }
      control={
        modelOptions.length === 0 ? (
          <span className="text-xs text-muted-foreground">暂无可用模型</span>
        ) : (
          <SettingsSelectControl
            value={currentValue ?? ""}
            onValueChange={(value) => {
              if (!value) {
                return;
              }
              const separatorIndex = value.indexOf(":");
              const provider = value.slice(0, separatorIndex) as ProviderKind;
              const model = value.slice(separatorIndex + 1);
              if (!provider || !model) {
                return;
              }
              props.onChange(provider, model);
            }}
            ariaLabel="Git 文案生成模型"
            triggerClassName="w-full sm:w-52"
            valueContent={selectedLabel}
          >
            {modelOptions.map((option) => (
              <SelectItem hideIndicator key={option.slug} value={`opencode:${option.slug}`}>
                {option.name}
              </SelectItem>
            ))}
          </SettingsSelectControl>
        )
      }
    />
  );
}
