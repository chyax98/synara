// FILE: CustomOpenCodeProviderPanel.tsx
// Purpose: Add OpenAI-compatible custom provider via auth.set + config.update.
// Layer: Settings UI (OpenCode desktop / OpenChamber pattern)

import { useState } from "react";

import { useAppSettings } from "~/appSettings";
import { SettingsRow } from "~/components/settings/SettingsPanelPrimitives";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  buildOpenCodeCatalogRequest,
  readOpenCodeCatalogConnection,
} from "~/lib/openCodeCatalogConnection";
import { mutateOpenCodeUpsertCustomProvider } from "~/lib/openCodeCatalogReactQuery";
import { PlusIcon } from "~/lib/icons";

const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9-_]*$/;

type CustomOpenCodeProviderPanelProps = {
  onSaved?: () => Promise<void>;
};

export function CustomOpenCodeProviderPanel(props: CustomOpenCodeProviderPanelProps) {
  const { settings } = useAppSettings();
  const [providerID, setProviderID] = useState("");
  const [name, setName] = useState("");
  const [baseURL, setBaseURL] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelId, setModelId] = useState("");
  const [modelName, setModelName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const trimmedId = providerID.trim();
    const trimmedName = name.trim();
    const trimmedUrl = baseURL.trim();
    const trimmedModelId = modelId.trim();
    const trimmedModelName = modelName.trim();

    if (!PROVIDER_ID_PATTERN.test(trimmedId)) {
      setError("提供商 ID 需为小写字母/数字/连字符（例如 my-openai-proxy）。");
      return;
    }
    if (!trimmedName || !trimmedUrl || !trimmedModelId || !trimmedModelName) {
      setError("请填写名称、Base URL 和至少一个模型。");
      return;
    }
    if (!/^https?:\/\//.test(trimmedUrl)) {
      setError("Base URL 需以 http:// 或 https:// 开头。");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const connection = readOpenCodeCatalogConnection(settings);
      await mutateOpenCodeUpsertCustomProvider({
        providerID: trimmedId,
        name: trimmedName,
        baseURL: trimmedUrl,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        models: [{ id: trimmedModelId, name: trimmedModelName }],
        ...buildOpenCodeCatalogRequest(connection),
      });
      await props.onSaved?.();
      setProviderID("");
      setName("");
      setBaseURL("");
      setApiKey("");
      setModelId("");
      setModelName("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存自定义提供商失败。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsRow
      title="自定义 OpenAI 兼容提供商"
      description="写入 opencode.json：npm @ai-sdk/openai-compatible + baseURL + models（与官方 OpenCode 桌面一致）。"
    >
      <div className="mt-4 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            size="sm"
            variant="soft"
            placeholder="提供商 ID（my-proxy）"
            value={providerID}
            onChange={(event) => setProviderID(event.target.value)}
            disabled={busy}
          />
          <Input
            size="sm"
            variant="soft"
            placeholder="显示名称"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={busy}
          />
        </div>
        <Input
          size="sm"
          variant="soft"
          placeholder="https://api.example.com/v1"
          value={baseURL}
          onChange={(event) => setBaseURL(event.target.value)}
          disabled={busy}
        />
        <Input
          size="sm"
          variant="soft"
          type="password"
          placeholder="API Key（可选）"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          disabled={busy}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            size="sm"
            variant="soft"
            placeholder="模型 ID"
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            disabled={busy}
          />
          <Input
            size="sm"
            variant="soft"
            placeholder="模型显示名"
            value={modelName}
            onChange={(event) => setModelName(event.target.value)}
            disabled={busy}
          />
        </div>
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={busy}
          onClick={() => void handleSave()}
        >
          <PlusIcon className="size-3.5" />
          保存到 OpenCode 配置
        </Button>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </SettingsRow>
  );
}
