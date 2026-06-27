import { describe, expect, it } from "vitest";
import {
  DEFAULT_MODEL,
  DEFAULT_MODEL_BY_PROVIDER,
  MODEL_OPTIONS,
  MODEL_OPTIONS_BY_PROVIDER,
} from "@t3tools/contracts";

import {
  formatModelDisplayName,
  getDefaultModel,
  getModelCapabilities,
  getModelOptions,
  getProviderOptionCurrentLabel,
  getProviderOptionDescriptors,
  buildProviderOptionSelectionsFromDescriptors,
  normalizeModelSlug,
  resolveApiModelId,
  resolveSelectableModel,
  resolveModelSlug,
  resolveModelSlugForProvider,
  normalizeOpenCodeModelOptions,
} from "./model";

describe("normalizeModelSlug", () => {
  it("returns null for empty or missing values", () => {
    expect(normalizeModelSlug("")).toBeNull();
    expect(normalizeModelSlug("   ")).toBeNull();
    expect(normalizeModelSlug(null)).toBeNull();
    expect(normalizeModelSlug(undefined)).toBeNull();
  });

  it("preserves non-aliased model slugs", () => {
    expect(normalizeModelSlug("openai/gpt-5")).toBe("openai/gpt-5");
    expect(normalizeModelSlug("anthropic/claude-sonnet-4")).toBe("anthropic/claude-sonnet-4");
  });
});

describe("resolveModelSlug", () => {
  it("returns default only when the model is missing", () => {
    expect(resolveModelSlug(undefined)).toBe(DEFAULT_MODEL);
    expect(resolveModelSlug(null)).toBe(DEFAULT_MODEL);
  });

  it("preserves unknown custom models as default fallback", () => {
    expect(resolveModelSlug("custom/internal-model")).toBe(DEFAULT_MODEL);
  });

  it("resolves only supported model options", () => {
    for (const model of MODEL_OPTIONS) {
      expect(resolveModelSlug(model.slug)).toBe(model.slug);
    }
  });

  it("supports provider-aware resolution", () => {
    expect(resolveModelSlugForProvider("opencode", undefined)).toBe(
      DEFAULT_MODEL_BY_PROVIDER.opencode,
    );
    expect(resolveModelSlugForProvider("opencode", "openai/gpt-5")).toBe("openai/gpt-5");
  });

  it("uses OpenCode defaults", () => {
    expect(getDefaultModel()).toBe(DEFAULT_MODEL);
    expect(getModelOptions()).toEqual(MODEL_OPTIONS);
    expect(getModelOptions("opencode")).toEqual(MODEL_OPTIONS_BY_PROVIDER.opencode);
  });
});

describe("resolveSelectableModel", () => {
  it("resolves exact slug matches", () => {
    expect(
      resolveSelectableModel("opencode", "openai/gpt-5", [
        { slug: "openai/gpt-5", name: "OpenAI GPT-5" },
        { slug: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4" },
      ]),
    ).toBe("openai/gpt-5");
  });

  it("returns null for unknown values that are not present in options", () => {
    expect(
      resolveSelectableModel("opencode", "custom/internal-model", [
        { slug: "openai/gpt-5", name: "OpenAI GPT-5" },
      ]),
    ).toBeNull();
  });
});

describe("getModelCapabilities", () => {
  it("returns built-in OpenCode capabilities for known models", () => {
    expect(getModelCapabilities("opencode", "openai/gpt-5")).toEqual({
      variantOptions: [],
      agentOptions: [],
    });
  });

  it("returns empty capabilities for unknown models", () => {
    expect(getModelCapabilities("opencode", "custom/model")).toEqual({
      variantOptions: [],
      agentOptions: [],
    });
  });
});

describe("provider option descriptor helpers", () => {
  it("projects OpenCode variant and agent options into descriptors", () => {
    const descriptors = getProviderOptionDescriptors({
      provider: "opencode",
      caps: {
        variantOptions: [
          { value: "default", label: "Default", isDefault: true },
          { value: "fast", label: "Fast" },
        ],
        agentOptions: [{ value: "build", label: "Build" }],
      },
      selections: { variant: "fast", agent: "build" },
    });

    const variant = descriptors.find((descriptor) => descriptor.id === "variant");
    const agent = descriptors.find((descriptor) => descriptor.id === "agent");

    expect(variant).toMatchObject({
      type: "select",
      currentValue: "fast",
    });
    expect(getProviderOptionCurrentLabel(variant)).toBe("Fast");
    expect(agent).toMatchObject({
      type: "select",
      currentValue: "build",
    });
  });

  it("honors explicit descriptors and serializes their current values", () => {
    const descriptors = getProviderOptionDescriptors({
      provider: "opencode",
      caps: {
        optionDescriptors: [
          {
            id: "variant",
            label: "Variant",
            type: "select",
            options: [
              { id: "default", label: "Default", isDefault: true },
              { id: "fast", label: "Fast" },
            ],
          },
        ],
      },
      selections: [{ id: "variant", value: "fast" }],
    });

    expect(descriptors).toHaveLength(1);
    expect(descriptors[0]).toMatchObject({ id: "variant", currentValue: "fast" });
    expect(buildProviderOptionSelectionsFromDescriptors(descriptors)).toEqual([
      { id: "variant", value: "fast" },
    ]);
  });
});

describe("formatModelDisplayName", () => {
  it("returns built-in display names for known models", () => {
    expect(formatModelDisplayName("openai/gpt-5")).toBe("OpenAI GPT-5");
  });

  it("leaves non-built-in custom slugs unchanged", () => {
    expect(formatModelDisplayName("custom/internal-model")).toBe("custom/internal-model");
  });
});

describe("normalizeOpenCodeModelOptions", () => {
  it("drops empty OpenCode options", () => {
    expect(normalizeOpenCodeModelOptions({})).toBeUndefined();
  });

  it("preserves non-empty OpenCode options", () => {
    expect(
      normalizeOpenCodeModelOptions({
        variant: "fast",
        agent: "build",
      }),
    ).toEqual({
      variant: "fast",
      agent: "build",
    });
  });
});

describe("resolveApiModelId", () => {
  it("returns the selected model slug", () => {
    expect(
      resolveApiModelId({
        provider: "opencode",
        model: "openai/gpt-5",
      }),
    ).toBe("openai/gpt-5");
  });
});