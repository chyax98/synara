// FILE: OpenCodeRuntimeSettingsRows.tsx
// Purpose: Configure the local OpenCode CLI used to spawn the SDK server for catalog discovery.
// Layer: Settings UI

import { useAppSettings } from "~/appSettings";
import { SettingResetButton } from "~/components/settings/SettingControls";
import { DebouncedSettingTextInput } from "~/components/settings/DebouncedSettingTextInput";
import { SettingsRow } from "~/components/settings/SettingsPanelPrimitives";
import { readOpenCodeCatalogConnection } from "~/lib/openCodeCatalogConnection";

export function OpenCodeRuntimeSettingsRows() {
  const { settings, updateSettings, defaults } = useAppSettings();
  const connection = readOpenCodeCatalogConnection(settings);

  const isBinaryDirty = settings.openCodeBinaryPath !== defaults.openCodeBinaryPath;

  return (
    <SettingsRow
      title="OpenCode 可执行文件"
      description="Synara 通过本机 OpenCode CLI 自动拉起 SDK Server 并拉取模型目录。若不在 PATH 中，请填写绝对路径（例如 /opt/homebrew/bin/opencode）。留空则使用系统 PATH 中的 opencode。"
      status={
        <code className="text-[11px] text-muted-foreground">
          当前解析：{connection.resolvedBinaryLabel}
        </code>
      }
      resetAction={
        isBinaryDirty ? (
          <SettingResetButton
            label="OpenCode 可执行文件"
            onClick={() => updateSettings({ openCodeBinaryPath: defaults.openCodeBinaryPath })}
          />
        ) : null
      }
      control={
        <DebouncedSettingTextInput
          size="sm"
          variant="soft"
          nativeInput
          spellCheck={false}
          placeholder="/opt/homebrew/bin/opencode"
          value={settings.openCodeBinaryPath}
          onCommit={(value) => updateSettings({ openCodeBinaryPath: value })}
          className="w-full sm:max-w-md"
        />
      }
    />
  );
}
