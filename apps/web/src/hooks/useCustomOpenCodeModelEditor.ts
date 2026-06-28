// FILE: useCustomOpenCodeModelEditor.ts
// Purpose: Shared add/remove logic for user-defined OpenCode model slugs.
// Layer: Web hooks

import { useCallback, useState } from "react";

import {
  MAX_CUSTOM_MODEL_LENGTH,
  MODEL_PROVIDER_SETTINGS,
  getCustomModelsForProvider,
  patchCustomModels,
  useAppSettings,
} from "~/appSettings";
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

export function useCustomOpenCodeModelEditor() {
  const { settings, updateSettings } = useAppSettings();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const customModels = getCustomModelsForProvider(settings, "opencode");
  const example = MODEL_PROVIDER_SETTINGS[0]?.example ?? "anthropic/claude-sonnet-4";

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const addModel = useCallback((): string | null => {
    const normalized = normalizeCustomOpenCodeModelInput(input);
    if (!normalized) {
      setError("请输入 providerID/modelID 格式的模型代号（例如 anthropic/claude-sonnet-4）。");
      return null;
    }
    if (customModels.includes(normalized)) {
      setError("该模型代号已存在。");
      return null;
    }
    updateSettings(patchCustomModels("opencode", [...customModels, normalized]));
    setInput("");
    setError(null);
    return normalized;
  }, [customModels, input, updateSettings]);

  const removeModel = useCallback(
    (slug: string) => {
      updateSettings(
        patchCustomModels(
          "opencode",
          customModels.filter((entry) => entry !== slug),
        ),
      );
      setError(null);
    },
    [customModels, updateSettings],
  );

  return {
    input,
    setInput,
    error,
    clearError,
    addModel,
    removeModel,
    customModels,
    example,
  };
}
