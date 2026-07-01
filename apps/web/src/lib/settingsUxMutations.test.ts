// FILE: settingsUxMutations.test.ts
// Purpose: OBSERVATION-backed tests for shipped settings mutation paths.
// Layer: Web settings UX tests

import { describe, expect, it } from "vitest";

import {
  applyAppSettingsPatch,
  defaultAppSettings,
  resolveKnobSideEffects,
  serverSettingsPatchForAppSettingsPatch,
  toggleModelVisibility,
  visibleModelOptionsAfterVisibilityToggle,
} from "./settingsUxMutations";

const SAMPLE_OPTIONS = [
  { slug: "anthropic/claude-sonnet-4", name: "Sonnet" },
  { slug: "openai/gpt-5", name: "GPT-5" },
] as const;

describe("settingsUxMutations (shipped settings paths)", () => {
  it("hides anthropic/claude from visible options then restores on unhide", () => {
    const base = defaultAppSettings();
    const ref = { providerID: "anthropic", modelID: "claude-sonnet-4" };

    const hidden = toggleModelVisibility(base, ref, false);
    const hiddenVisible = visibleModelOptionsAfterVisibilityToggle({
      settings: base,
      options: SAMPLE_OPTIONS,
      ref,
      visible: false,
    });
    console.info(
      "OBSERVATION: hideModel.visibleSlugs",
      JSON.stringify(hiddenVisible.map((option) => option.slug)),
    );
    expect(hiddenVisible.map((option) => option.slug)).toEqual(["openai/gpt-5"]);
    expect(hidden.hiddenModels).toEqual([ref]);

    const restored = toggleModelVisibility(hidden, ref, true);
    const restoredVisible = visibleModelOptionsAfterVisibilityToggle({
      settings: hidden,
      options: SAMPLE_OPTIONS,
      ref,
      visible: true,
    });
    console.info(
      "OBSERVATION: unhideModel.visibleSlugs",
      JSON.stringify(restoredVisible.map((option) => option.slug)),
    );
    expect(restoredVisible.map((option) => option.slug)).toEqual([
      "anthropic/claude-sonnet-4",
      "openai/gpt-5",
    ]);
    expect(restored.hiddenModels).toEqual([]);
  });

  it("flips enableAssistantStreaming and resolves delivery mode + server patch", () => {
    const base = defaultAppSettings();
    expect(base.enableAssistantStreaming).toBe(false);

    const streaming = applyAppSettingsPatch(base, { enableAssistantStreaming: true });
    const effects = resolveKnobSideEffects(streaming);
    const serverPatch = serverSettingsPatchForAppSettingsPatch({ enableAssistantStreaming: true });

    console.info("OBSERVATION: streaming.deliveryMode", effects.assistantDeliveryMode);
    console.info("OBSERVATION: streaming.serverPatch", JSON.stringify(serverPatch));

    expect(streaming.enableAssistantStreaming).toBe(true);
    expect(effects.assistantDeliveryMode).toBe("streaming");
    expect(serverPatch).toEqual({ enableAssistantStreaming: true });

    const buffered = applyAppSettingsPatch(streaming, { enableAssistantStreaming: false });
    expect(resolveKnobSideEffects(buffered).assistantDeliveryMode).toBe("buffered");
  });

  it("mirrors ProviderDetailSettingsPanel setModelVisible via updateSettings merge", () => {
    const base = defaultAppSettings();
    const ref = { providerID: "anthropic", modelID: "claude-sonnet-4" };
    const panelNext = toggleModelVisibility(base, ref, false);
    const updateSettingsResult = applyAppSettingsPatch(base, {
      hiddenModels: panelNext.hiddenModels,
    });

    console.info(
      "OBSERVATION: panelPath.updateSettings.hiddenModels",
      JSON.stringify(updateSettingsResult.hiddenModels),
    );
    expect(updateSettingsResult.hiddenModels).toEqual([ref]);
    expect(
      visibleModelOptionsAfterVisibilityToggle({
        settings: updateSettingsResult,
        options: SAMPLE_OPTIONS,
        ref,
        visible: false,
      }).map((option) => option.slug),
    ).toEqual(["openai/gpt-5"]);
  });

  it("round-trips openCodeAutoReloadCatalog via normalizeStoredAppSettings path", () => {
    const base = defaultAppSettings();
    expect(base.openCodeAutoReloadCatalog).toBe(true);

    const disabled = applyAppSettingsPatch(base, { openCodeAutoReloadCatalog: false });
    console.info(
      "OBSERVATION: openCodeAutoReloadCatalog.disabled",
      disabled.openCodeAutoReloadCatalog,
    );
    expect(disabled.openCodeAutoReloadCatalog).toBe(false);

    const restored = applyAppSettingsPatch(disabled, { openCodeAutoReloadCatalog: true });
    console.info(
      "OBSERVATION: openCodeAutoReloadCatalog.restored",
      restored.openCodeAutoReloadCatalog,
    );
    expect(restored.openCodeAutoReloadCatalog).toBe(true);

    const localOnlyPatch = serverSettingsPatchForAppSettingsPatch({
      openCodeAutoReloadCatalog: false,
    });
    console.info(
      "OBSERVATION: openCodeAutoReloadCatalog.serverPatch",
      JSON.stringify(localOnlyPatch),
    );
    expect(localOnlyPatch).toEqual({});
  });
});
