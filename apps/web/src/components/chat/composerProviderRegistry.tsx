// FILE: composerProviderRegistry.tsx
// Purpose: Centralizes OpenCode composer state and trait picker rendering.
// Layer: Chat composer orchestration

import {
  type ModelSlug,
  type ProviderAgentDescriptor,
  type ProviderKind,
  type ProviderModelDescriptor,
  type ProviderModelOptions,
  type ThreadId,
} from "@t3tools/contracts";
import {
  getDefaultEffort,
  normalizeOpenCodeModelOptions,
  resolveLabeledOptionValue,
  trimOrNull,
} from "@t3tools/shared/model";
import type { ReactNode } from "react";
import { TraitsMenuContent, TraitsPicker } from "./TraitsPicker";
import { getComposerTraitSelection, hasVisibleComposerTraitControls } from "./composerTraits";
import { getRuntimeAwareModelCapabilities } from "./runtimeModelCapabilities";

const OPENCODE_PROVIDER: ProviderKind = "opencode";

export type ComposerProviderStateInput = {
  provider: ProviderKind;
  model: ModelSlug;
  runtimeModel?: ProviderModelDescriptor | undefined;
  prompt: string;
  modelOptions: ProviderModelOptions | null | undefined;
};

export type ComposerProviderState = {
  provider: ProviderKind;
  promptEffort: string | null;
  modelOptionsForDispatch: ProviderModelOptions["opencode"] | undefined;
  composerFrameClassName?: string;
  composerSurfaceClassName?: string;
  modelPickerIconClassName?: string;
};

type ProviderTraitRenderInput = {
  threadId: ThreadId;
  model: ModelSlug;
  runtimeModel?: ProviderModelDescriptor | undefined;
  runtimeModels?: ReadonlyArray<ProviderModelDescriptor> | null | undefined;
  runtimeAgents?: ReadonlyArray<ProviderAgentDescriptor> | null | undefined;
  modelOptions: ProviderModelOptions["opencode"] | undefined;
  prompt: string;
  includeFastMode?: boolean;
  onPromptChange: (prompt: string) => void;
};

type ProviderTraitPickerRenderInput = ProviderTraitRenderInput & {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  shortcutLabel?: string | null;
};

function getOpenCodeProviderState(input: ComposerProviderStateInput): ComposerProviderState {
  const { model, runtimeModel, modelOptions } = input;
  const caps = getRuntimeAwareModelCapabilities({
    provider: OPENCODE_PROVIDER,
    model,
    runtimeModel,
  });

  const providerOptions = modelOptions?.opencode;
  const rawEffort = trimOrNull(providerOptions?.variant);
  const variantOptions = caps.variantOptions ?? [];
  const reasoningVariant =
    rawEffort && variantOptions.some((option) => option.value === rawEffort) ? rawEffort : undefined;
  const agent = trimOrNull(providerOptions?.agent);

  let normalizedOptions: ProviderModelOptions["opencode"] | undefined;
  if (variantOptions.length > 0) {
    const nextOptions = {
      ...(reasoningVariant ? { variant: reasoningVariant } : {}),
      ...(agent ? { agent } : {}),
    };
    normalizedOptions = Object.keys(nextOptions).length > 0 ? nextOptions : undefined;
  } else {
    normalizedOptions = normalizeOpenCodeModelOptions(providerOptions);
  }

  const draftEffort = trimOrNull(rawEffort);
  const defaultEffort = getDefaultEffort(caps);
  const promptEffort = resolveLabeledOptionValue(caps.variantOptions, draftEffort)
    ?? (draftEffort && hasEffortLevel(caps, draftEffort) ? draftEffort : defaultEffort);

  return {
    provider: OPENCODE_PROVIDER,
    promptEffort,
    modelOptionsForDispatch: normalizedOptions,
  };
}

function hasEffortLevel(
  caps: ReturnType<typeof getRuntimeAwareModelCapabilities>,
  effort: string,
): boolean {
  return (caps.variantOptions ?? []).some((level) => level.value === effort);
}

function renderTraitsMenuContent(input: ProviderTraitRenderInput): ReactNode {
  return (
    <TraitsMenuContent
      provider={OPENCODE_PROVIDER}
      threadId={input.threadId}
      model={input.model}
      runtimeModel={input.runtimeModel}
      runtimeModels={input.runtimeModels}
      runtimeAgents={input.runtimeAgents}
      modelOptions={input.modelOptions}
      prompt={input.prompt}
      {...(input.includeFastMode === undefined ? {} : { includeFastMode: input.includeFastMode })}
      onPromptChange={input.onPromptChange}
    />
  );
}

function renderTraitsPicker(input: ProviderTraitPickerRenderInput): ReactNode {
  return (
    <TraitsPicker
      provider={OPENCODE_PROVIDER}
      threadId={input.threadId}
      model={input.model}
      runtimeModel={input.runtimeModel}
      runtimeModels={input.runtimeModels}
      runtimeAgents={input.runtimeAgents}
      modelOptions={input.modelOptions}
      prompt={input.prompt}
      {...(input.open !== undefined ? { open: input.open } : {})}
      {...(input.onOpenChange ? { onOpenChange: input.onOpenChange } : {})}
      {...(input.shortcutLabel !== undefined ? { shortcutLabel: input.shortcutLabel } : {})}
      {...(input.includeFastMode === undefined ? {} : { includeFastMode: input.includeFastMode })}
      onPromptChange={input.onPromptChange}
    />
  );
}

export function getComposerProviderState(input: ComposerProviderStateInput): ComposerProviderState {
  return getOpenCodeProviderState(input);
}

export function renderProviderTraitsMenuContent(input: {
  provider: ProviderKind;
  threadId: ThreadId;
  model: ModelSlug;
  runtimeModel?: ProviderModelDescriptor | undefined;
  runtimeModels?: ReadonlyArray<ProviderModelDescriptor> | null | undefined;
  runtimeAgents?: ReadonlyArray<ProviderAgentDescriptor> | null | undefined;
  modelOptions: ProviderModelOptions["opencode"] | undefined;
  prompt: string;
  includeFastMode?: boolean;
  onPromptChange: (prompt: string) => void;
}): ReactNode {
  const selection = getComposerTraitSelection(
    OPENCODE_PROVIDER,
    input.model,
    input.prompt,
    input.modelOptions,
    input.runtimeModel,
  );
  if (
    !hasVisibleComposerTraitControls(
      selection,
      input.includeFastMode === undefined ? undefined : { includeFastMode: input.includeFastMode },
    ) &&
    (input.runtimeAgents?.length ?? 0) === 0
  ) {
    return null;
  }
  return renderTraitsMenuContent(input);
}

export function renderProviderTraitsPicker(input: {
  provider: ProviderKind;
  threadId: ThreadId;
  model: ModelSlug;
  runtimeModel?: ProviderModelDescriptor | undefined;
  runtimeModels?: ReadonlyArray<ProviderModelDescriptor> | null | undefined;
  runtimeAgents?: ReadonlyArray<ProviderAgentDescriptor> | null | undefined;
  modelOptions: ProviderModelOptions["opencode"] | undefined;
  prompt: string;
  includeFastMode?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  shortcutLabel?: string | null;
  onPromptChange: (prompt: string) => void;
}): ReactNode {
  const selection = getComposerTraitSelection(
    OPENCODE_PROVIDER,
    input.model,
    input.prompt,
    input.modelOptions,
    input.runtimeModel,
  );
  if (
    !hasVisibleComposerTraitControls(
      selection,
      input.includeFastMode === undefined ? undefined : { includeFastMode: input.includeFastMode },
    ) &&
    (input.runtimeAgents?.length ?? 0) === 0
  ) {
    return null;
  }
  return renderTraitsPicker(input);
}