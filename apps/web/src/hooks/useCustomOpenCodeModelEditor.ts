// FILE: useCustomOpenCodeModelEditor.ts
// Purpose: Add/remove OpenCode models via SDK config.update (writes opencode.json).
// Layer: Web hooks

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import { MAX_CUSTOM_MODEL_LENGTH, MODEL_PROVIDER_SETTINGS, useAppSettings } from "~/appSettings";
import {
  buildOpenCodeCatalogRequest,
  readOpenCodeCatalogConnection,
} from "~/lib/openCodeCatalogConnection";
import { maybeReloadOpenCodeCatalogAfterMutation } from "~/lib/openCodeCatalogReload";
import {
  mutateOpenCodeAddProviderModel,
  mutateOpenCodeRemoveProviderModel,
  openCodeConfigProvidersQueryOptions,
} from "~/lib/openCodeCatalogReactQuery";
import { listConfiguredModelSlugs } from "~/lib/openCodeConfiguredModels";
import { parseOpenCodeModelSlug } from "~/lib/modelCatalogSettings";

export function normalizeCustomOpenCodeModelInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || !parseOpenCodeModelSlug(trimmed)) {
    return null;
  }
  if (trimmed.length > MAX_CUSTOM_MODEL_LENGTH) {
    return null;
  }
  return trimmed;
}

export function useCustomOpenCodeModelEditor(input?: { onCatalogRefresh?: () => Promise<void> }) {
  const queryClient = useQueryClient();
  const { settings } = useAppSettings();
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const connection = readOpenCodeCatalogConnection(settings);
  const catalogRequest = buildOpenCodeCatalogRequest(connection);

  const configProvidersQuery = useQuery(
    openCodeConfigProvidersQueryOptions({
      binaryPath: connection.binaryPath,
      serverUrl: connection.serverUrl,
      serverPassword: connection.serverPassword,
      cwd: null,
    }),
  );

  const configuredModels = useMemo(
    () => listConfiguredModelSlugs(configProvidersQuery.data?.providers ?? []),
    [configProvidersQuery.data?.providers],
  );

  const example = MODEL_PROVIDER_SETTINGS[0]?.example ?? "anthropic/claude-sonnet-4";

  const refreshCatalog = useCallback(async () => {
    await maybeReloadOpenCodeCatalogAfterMutation(queryClient, settings.openCodeAutoReloadCatalog);
    if (settings.openCodeAutoReloadCatalog) {
      await input?.onCatalogRefresh?.();
    }
    await configProvidersQuery.refetch();
  }, [configProvidersQuery, input, queryClient, settings.openCodeAutoReloadCatalog]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const addModel = useCallback(async (): Promise<string | null> => {
    const normalized = normalizeCustomOpenCodeModelInput(inputValue);
    if (!normalized) {
      setError("请输入 providerID/modelID 格式的模型代号（例如 anthropic/claude-sonnet-4）。");
      return null;
    }
    if (configuredModels.includes(normalized)) {
      setError("该模型已在 OpenCode 配置中。");
      return null;
    }

    setBusy(true);
    setError(null);
    try {
      await mutateOpenCodeAddProviderModel({
        slug: normalized,
        ...catalogRequest,
      });
      await refreshCatalog();
      setInputValue("");
      return normalized;
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "写入 OpenCode 配置失败，请重试。");
      return null;
    } finally {
      setBusy(false);
    }
  }, [catalogRequest, configuredModels, inputValue, refreshCatalog]);

  const removeModel = useCallback(
    async (slug: string) => {
      setBusy(true);
      setError(null);
      try {
        await mutateOpenCodeRemoveProviderModel({
          slug,
          scope: "all",
          ...catalogRequest,
        });
        await refreshCatalog();
      } catch (removeError) {
        setError(removeError instanceof Error ? removeError.message : "从 OpenCode 配置移除失败。");
      } finally {
        setBusy(false);
      }
    },
    [catalogRequest, refreshCatalog],
  );

  return {
    input: inputValue,
    setInput: setInputValue,
    error,
    clearError,
    addModel,
    removeModel,
    customModels: configuredModels,
    example,
    busy,
    isLoadingModels: configProvidersQuery.isLoading,
  };
}
