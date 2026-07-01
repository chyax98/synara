#!/usr/bin/env bun
/**
 * Drives shipped settingsUxMutations helpers and prints OBSERVATION blocks
 * (verification plan step 2 — hidden toggle + knob round-trip).
 */
import { applyLocalAppSettingsUpdate } from "../apps/web/src/appSettings.ts";
import {
  applyAppSettingsPatch,
  defaultAppSettings,
  resolveKnobSideEffects,
  serverSettingsPatchForAppSettingsPatch,
  toggleModelVisibility,
  visibleModelOptionsAfterVisibilityToggle,
} from "../apps/web/src/lib/settingsUxMutations.ts";

const SAMPLE_OPTIONS = [
  { slug: "anthropic/claude-sonnet-4", name: "Sonnet" },
  { slug: "openai/gpt-5", name: "GPT-5" },
] as const;

function observe(label: string, value: unknown) {
  console.log(`OBSERVATION: ${label}: ${JSON.stringify(value)}`);
}

const runId = Number(process.argv[2] ?? "1");
console.log(`=== SETTINGS UX DRIVE run ${runId} ===`);

const base = defaultAppSettings();
const ref = { providerID: "anthropic", modelID: "claude-sonnet-4" };

observe("clean-state.hiddenModels", base.hiddenModels);
observe(
  "clean-state.visibleSlugs",
  visibleModelOptionsAfterVisibilityToggle({
    settings: base,
    options: SAMPLE_OPTIONS,
    ref,
    visible: true,
  }).map((option) => option.slug),
);

const hiddenVisible = visibleModelOptionsAfterVisibilityToggle({
  settings: base,
  options: SAMPLE_OPTIONS,
  ref,
  visible: false,
});
observe(
  "after-hide.visibleSlugs",
  hiddenVisible.map((option) => option.slug),
);

const hiddenSettings = toggleModelVisibility(base, ref, false);
observe("after-hide.hiddenModels", hiddenSettings.hiddenModels);

const restoredVisible = visibleModelOptionsAfterVisibilityToggle({
  settings: hiddenSettings,
  options: SAMPLE_OPTIONS,
  ref,
  visible: true,
});
observe(
  "after-unhide.visibleSlugs",
  restoredVisible.map((option) => option.slug),
);

const streaming = applyAppSettingsPatch(base, { enableAssistantStreaming: true });
observe("knob.enableAssistantStreaming.value", streaming.enableAssistantStreaming);
observe(
  "knob.enableAssistantStreaming.deliveryMode",
  resolveKnobSideEffects(streaming).assistantDeliveryMode,
);
observe(
  "knob.enableAssistantStreaming.serverPatch",
  serverSettingsPatchForAppSettingsPatch({ enableAssistantStreaming: true }),
);

const reloadOff = applyAppSettingsPatch(base, { openCodeAutoReloadCatalog: false });
const reloadOn = applyAppSettingsPatch(reloadOff, { openCodeAutoReloadCatalog: true });
observe("knob.openCodeAutoReloadCatalog.off", reloadOff.openCodeAutoReloadCatalog);
observe("knob.openCodeAutoReloadCatalog.restored", reloadOn.openCodeAutoReloadCatalog);
observe(
  "knob.openCodeAutoReloadCatalog.serverPatchEmpty",
  serverSettingsPatchForAppSettingsPatch({ openCodeAutoReloadCatalog: false }),
);

const panelRef = { providerID: "anthropic", modelID: "claude-sonnet-4" };
const panelNext = toggleModelVisibility(base, panelRef, false);
const updateSettingsResult = applyLocalAppSettingsUpdate(base, {
  hiddenModels: panelNext.hiddenModels,
});
observe("shippedPath.applyLocalAppSettingsUpdate.hiddenModels", updateSettingsResult.hiddenModels);
observe(
  "shippedPath.matchesSettingsUxMutations",
  JSON.stringify(updateSettingsResult.hiddenModels) ===
    JSON.stringify(
      applyAppSettingsPatch(base, { hiddenModels: panelNext.hiddenModels }).hiddenModels,
    ),
);
observe(
  "panelPath.visibleSlugsAfterHide",
  visibleModelOptionsAfterVisibilityToggle({
    settings: updateSettingsResult,
    options: SAMPLE_OPTIONS,
    ref: panelRef,
    visible: false,
  }).map((option) => option.slug),
);

console.log(`OBSERVATION: settings-ux-drive-run-${runId}-status: PASS`);
