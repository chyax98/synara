// FILE: settingsUxMutations.ts
// Purpose: Pure settings mutation helpers mirroring useAppSettings + ProviderDetailSettingsPanel.
// Layer: Web settings UX (testable, no React/WS)

import {
  AppSettingsSchema,
  applyLocalAppSettingsUpdate,
  appSettingsPatchToServerSettingsPatch,
  resolveAssistantDeliveryMode,
  type AppSettings,
} from "~/appSettings";
import {
  filterVisibleModelOptions,
  toggleHiddenModelRef,
  type HiddenModelRef,
} from "~/lib/modelCatalogSettings";
import type { ProviderModelOption } from "~/providerModelOptions";

export function defaultAppSettings(): AppSettings {
  return AppSettingsSchema.makeUnsafe({});
}

/** Mirrors `useAppSettings().updateSettings` local merge + normalize. */
export function applyAppSettingsPatch(
  previous: AppSettings,
  patch: Partial<AppSettings>,
): AppSettings {
  return applyLocalAppSettingsUpdate(previous, patch);
}

/** Mirrors ProviderDetailSettingsPanel model visibility toggle. */
export function toggleModelVisibility(
  settings: AppSettings,
  ref: HiddenModelRef,
  visible: boolean,
): AppSettings {
  return applyAppSettingsPatch(settings, {
    hiddenModels: toggleHiddenModelRef(settings.hiddenModels, ref, visible),
  });
}

/** Side effects derived from geek knobs (streaming transport, etc.). */
export function resolveKnobSideEffects(settings: AppSettings): {
  assistantDeliveryMode: ReturnType<typeof resolveAssistantDeliveryMode>;
} {
  return {
    assistantDeliveryMode: resolveAssistantDeliveryMode(settings),
  };
}

/** Server patch shape emitted when updateSettings touches server-backed fields. */
export function serverSettingsPatchForAppSettingsPatch(patch: Partial<AppSettings>) {
  return appSettingsPatchToServerSettingsPatch(patch);
}

export function visibleModelOptionsAfterVisibilityToggle(input: {
  settings: AppSettings;
  options: ReadonlyArray<ProviderModelOption>;
  ref: HiddenModelRef;
  visible: boolean;
}): ReadonlyArray<ProviderModelOption> {
  const nextSettings = toggleModelVisibility(input.settings, input.ref, input.visible);
  return filterVisibleModelOptions(input.options, nextSettings.hiddenModels);
}
