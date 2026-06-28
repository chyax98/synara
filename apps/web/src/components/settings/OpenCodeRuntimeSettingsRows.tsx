// FILE: OpenCodeRuntimeSettingsRows.tsx
// Purpose: Configure how Synara reaches the local/external OpenCode SDK server.
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
  const isServerUrlDirty = settings.openCodeServerUrl !== defaults.openCodeServerUrl;

  return (
    <>
      <SettingsRow
        title="OpenCode 可执行文件"
        description="Synara 通过 OpenCode SDK 拉取模型目录。若不在 PATH 中，请填写绝对路径（例如 /opt/homebrew/bin/opencode）。留空则使用系统 PATH 中的 opencode。"
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

      <SettingsRow
        title="OpenCode Server URL（可选）"
        description="若你已在本地或远程运行 OpenCode Server，可填写其 URL；留空则由 Synara 按上面的可执行文件自动拉起 SDK Server。"
        resetAction={
          isServerUrlDirty ? (
            <SettingResetButton
              label="OpenCode Server URL"
              onClick={() => updateSettings({ openCodeServerUrl: defaults.openCodeServerUrl })}
            />
          ) : null
        }
        control={
          <DebouncedSettingTextInput
            size="sm"
            variant="soft"
            nativeInput
            spellCheck={false}
            placeholder="http://127.0.0.1:4096"
            value={settings.openCodeServerUrl}
            onCommit={(value) => updateSettings({ openCodeServerUrl: value })}
            className="w-full sm:max-w-md"
          />
        }
      />
    </>
  );
}
