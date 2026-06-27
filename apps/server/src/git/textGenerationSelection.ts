import type { ModelSelection, ProviderStartOptions } from "@t3tools/contracts";

export interface TextGenerationProviderInput {
  readonly modelSelection: ModelSelection;
  readonly providerOptions?: ProviderStartOptions;
}

export function hasDedicatedTextGenerationProvider(provider: string | undefined): boolean {
  return provider === "opencode";
}

export function resolveTextGenerationInputForSelection(
  modelSelection: ModelSelection | undefined,
  providerOptions: ProviderStartOptions | undefined,
): TextGenerationProviderInput | null {
  if (!modelSelection || !hasDedicatedTextGenerationProvider(modelSelection.provider)) {
    return null;
  }

  return {
    modelSelection,
    ...(providerOptions ? { providerOptions } : {}),
  };
}
