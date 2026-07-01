// FILE: ProviderConfigRemoveControls.tsx
// Purpose: Scope-aware provider config/auth removal (OpenChamber-style, decoupled from connected state).
// Layer: Settings UI

import { useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import type { OpenCodeCatalogConnection } from "~/lib/openCodeCatalogConnection";
import { buildOpenCodeCatalogRequest } from "~/lib/openCodeCatalogConnection";
import { mutateOpenCodeProviderDisconnect } from "~/lib/openCodeCatalogReactQuery";
import {
  hasProviderConfigLayer,
  resolveDisconnectScopeOptions,
} from "~/lib/openCodeProviderSources";
import type {
  OpenCodeProviderConfigSources,
  OpenCodeProviderDisconnectScope,
} from "@t3tools/contracts";

export function ProviderConfigRemoveControls(props: {
  providerId: string;
  connection: OpenCodeCatalogConnection;
  configSources: OpenCodeProviderConfigSources;
  onRemoved: () => Promise<void>;
}) {
  const [disconnectScope, setDisconnectScope] = useState<OpenCodeProviderDisconnectScope>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopeOptions = useMemo(
    () => resolveDisconnectScopeOptions(props.configSources),
    [props.configSources],
  );

  if (!hasProviderConfigLayer(props.configSources)) {
    return null;
  }

  const handleRemove = async () => {
    setBusy(true);
    setError(null);
    try {
      await mutateOpenCodeProviderDisconnect({
        providerID: props.providerId,
        scope: disconnectScope,
        ...buildOpenCodeCatalogRequest(props.connection),
      });
      await props.onRemoved();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "移除配置失败。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2 border-t border-[color:var(--color-border)] pt-3">
      <label
        className="text-xs font-medium text-foreground"
        htmlFor={`provenance-disconnect-scope-${props.providerId}`}
      >
        移除配置 / 断开
      </label>
      <p className="text-[11px] text-muted-foreground">
        适用于未连接但已写入 opencode.json 的自定义提供商，或需要按层清理配置时。
      </p>
      <select
        id={`provenance-disconnect-scope-${props.providerId}`}
        className="h-8 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2 text-xs text-foreground"
        value={disconnectScope}
        onChange={(event) =>
          setDisconnectScope(event.target.value as OpenCodeProviderDisconnectScope)
        }
        disabled={busy}
      >
        {scopeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Button
        type="button"
        variant="outline"
        size="xs"
        disabled={busy}
        onClick={() => void handleRemove()}
      >
        {busy ? "移除中…" : "移除配置"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
