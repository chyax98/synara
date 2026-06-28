// FILE: ProviderAuthSettingsPanel.tsx
// Purpose: Connect/disconnect an OpenCode upstream provider via API key or OAuth.
// Layer: Settings UI

import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { buildOpenCodeCatalogRequest } from "~/lib/openCodeCatalogConnection";
import type { OpenCodeCatalogConnection } from "~/lib/openCodeCatalogConnection";
import {
  mutateOpenCodeAuthRemove,
  mutateOpenCodeAuthSet,
  mutateOpenCodeOauthAuthorize,
  mutateOpenCodeOauthCallback,
} from "~/lib/openCodeCatalogReactQuery";
import { ensureNativeApi } from "~/nativeApi";
import { cn } from "~/lib/utils";
import { SETTINGS_CARD_CLASS_NAME } from "~/settingsPanelStyles";
import type { OpenCodeProviderAuthMethod } from "@t3tools/contracts";

export function ProviderAuthSettingsPanel(props: {
  providerId: string;
  providerName: string;
  connected: boolean;
  connection: OpenCodeCatalogConnection;
  authMethods: ReadonlyArray<OpenCodeProviderAuthMethod>;
  onAuthChanged: () => Promise<void>;
  variant?: "card" | "inline";
}) {
  const variant = props.variant ?? "card";
  const [apiKey, setApiKey] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingOauthMethodIndex, setPendingOauthMethodIndex] = useState<number | null>(null);
  const [oauthCode, setOauthCode] = useState("");
  const [oauthInstructions, setOauthInstructions] = useState<string | null>(null);

  const catalogRequest = buildOpenCodeCatalogRequest(props.connection);

  const runMutation = async (key: string, action: () => Promise<void>) => {
    setBusyKey(key);
    setErrorMessage(null);
    try {
      await action();
      await props.onAuthChanged();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "操作失败，请重试。");
    } finally {
      setBusyKey(null);
    }
  };

  const handleSaveApiKey = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setErrorMessage("请输入 API Key。");
      return;
    }
    void runMutation(`api:${props.providerId}`, async () => {
      await mutateOpenCodeAuthSet({
        providerID: props.providerId,
        apiKey: trimmed,
        ...catalogRequest,
      });
      setApiKey("");
    });
  };

  const handleDisconnect = () => {
    void runMutation(`remove:${props.providerId}`, async () => {
      await mutateOpenCodeAuthRemove({
        providerID: props.providerId,
        ...catalogRequest,
      });
    });
  };

  const handleOauthStart = (methodIndex: number) => {
    void runMutation(`oauth:${props.providerId}:${methodIndex}`, async () => {
      const result = await mutateOpenCodeOauthAuthorize({
        providerID: props.providerId,
        method: methodIndex,
        ...catalogRequest,
      });
      setOauthInstructions(result.instructions);
      setPendingOauthMethodIndex(methodIndex);
      setOauthCode("");
      if (result.url) {
        const api = await ensureNativeApi();
        void api.shell.openExternal(result.url);
      }
    });
  };

  const handleOauthComplete = () => {
    if (pendingOauthMethodIndex === null) {
      return;
    }
    void runMutation(`oauth-complete:${props.providerId}:${pendingOauthMethodIndex}`, async () => {
      await mutateOpenCodeOauthCallback({
        providerID: props.providerId,
        method: pendingOauthMethodIndex,
        ...(oauthCode.trim() ? { code: oauthCode.trim() } : {}),
        ...catalogRequest,
      });
      setPendingOauthMethodIndex(null);
      setOauthCode("");
      setOauthInstructions(null);
    });
  };

  const indexedAuthMethods = props.authMethods.map((method, index) => ({ method, index }));
  const apiMethods = indexedAuthMethods.filter((entry) => entry.method.type === "api");
  const oauthMethods = indexedAuthMethods.filter((entry) => entry.method.type === "oauth");

  const content = (
    <div className="space-y-3">
      {errorMessage ? <p className="text-xs text-destructive">{errorMessage}</p> : null}

      {props.connected ? (
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={busyKey !== null}
          onClick={handleDisconnect}
        >
          断开连接
        </Button>
      ) : (
        <div className="space-y-3">
          {apiMethods.length > 0 ? (
            <div className="space-y-2">
              <label
                className="text-xs font-medium text-foreground"
                htmlFor={`api-key-${props.providerId}`}
              >
                API Key
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id={`api-key-${props.providerId}`}
                  type="password"
                  size="sm"
                  variant="soft"
                  nativeInput
                  autoComplete="off"
                  placeholder="粘贴 API Key…"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                />
                <Button
                  type="button"
                  size="xs"
                  disabled={busyKey !== null}
                  onClick={handleSaveApiKey}
                >
                  保存
                </Button>
              </div>
            </div>
          ) : null}

          {oauthMethods.map(({ method, index }) => (
            <div key={`${props.providerId}-oauth-${index}`} className="space-y-2">
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={busyKey !== null}
                onClick={() => handleOauthStart(index)}
              >
                {method.label || "OAuth 登录"}
              </Button>
              {pendingOauthMethodIndex === index ? (
                <div className="space-y-2 rounded-lg border border-[color:var(--color-border)] p-3">
                  {oauthInstructions ? (
                    <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                      {oauthInstructions}
                    </p>
                  ) : null}
                  <Input
                    type="text"
                    size="sm"
                    variant="soft"
                    nativeInput
                    placeholder="授权码（如需要）"
                    value={oauthCode}
                    onChange={(event) => setOauthCode(event.target.value)}
                  />
                  <Button
                    type="button"
                    size="xs"
                    disabled={busyKey !== null}
                    onClick={handleOauthComplete}
                  >
                    完成授权
                  </Button>
                </div>
              ) : null}
            </div>
          ))}

          {apiMethods.length === 0 && oauthMethods.length === 0 ? (
            <p className="text-xs text-muted-foreground">此提供商暂无可用的认证方式。</p>
          ) : null}
        </div>
      )}
    </div>
  );

  if (variant === "inline") {
    return content;
  }

  return (
    <div className={cn(SETTINGS_CARD_CLASS_NAME, "space-y-3 p-4")}>
      <div className="space-y-1">
        <h4 className="text-sm font-medium text-foreground">{props.providerName}</h4>
        <p className="text-[11px] text-muted-foreground">
          {props.connected
            ? "此提供商已连接。断开后需要重新认证才能使用其模型。"
            : "连接此提供商后即可在选单中使用其模型。"}
        </p>
      </div>
      {content}
    </div>
  );
}
