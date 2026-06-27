import { Effect, Layer } from "effect";

import {
  OpenCodeTextGeneration,
  type TextGenerationShape,
  TextGeneration,
} from "../Services/TextGeneration.ts";

const makeProviderTextGeneration = Effect.gen(function* () {
  const openCodeTextGeneration = yield* OpenCodeTextGeneration;

  const resolveImplementation = (): TextGenerationShape => openCodeTextGeneration;

  return {
    generateCommitMessage: (input) => resolveImplementation().generateCommitMessage(input),
    generatePrContent: (input) => resolveImplementation().generatePrContent(input),
    generateDiffSummary: (input) => resolveImplementation().generateDiffSummary(input),
    generateBranchName: (input) => resolveImplementation().generateBranchName(input),
    generateThreadTitle: (input) => resolveImplementation().generateThreadTitle(input),
    generateThreadRecap: (input) => resolveImplementation().generateThreadRecap(input),
    generateAutomationIntent: (input) =>
      resolveImplementation().generateAutomationIntent(input),
    evaluateAutomationCompletion: (input) =>
      resolveImplementation().evaluateAutomationCompletion(input),
  } satisfies TextGenerationShape;
});

export const ProviderTextGenerationLive = Layer.effect(TextGeneration, makeProviderTextGeneration);