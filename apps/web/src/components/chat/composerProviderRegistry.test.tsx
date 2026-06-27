import { type ProviderModelDescriptor, ThreadId } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vitest";
import {
  getComposerProviderState,
  renderProviderTraitsMenuContent,
  renderProviderTraitsPicker,
} from "./composerProviderRegistry";
import { getComposerTraitSelection } from "./composerTraits";

const OPENCODE_RUNTIME_MODEL_WITH_REASONING: ProviderModelDescriptor = {
  slug: "openai/gpt-5.4",
  name: "GPT-5.4",
  upstreamProviderId: "openai",
  upstreamProviderName: "OpenAI",
  supportedReasoningEfforts: [
    { value: "none" },
    { value: "low" },
    { value: "medium" },
    { value: "high" },
    { value: "xhigh" },
  ],
  defaultReasoningEffort: "medium",
};

const OPENCODE_RUNTIME_MODEL_WITHOUT_DEFAULT: ProviderModelDescriptor = {
  slug: "opencode/gpt-5-nano",
  name: "GPT-5 Nano",
  upstreamProviderId: "opencode",
  upstreamProviderName: "OpenCode",
  supportedReasoningEfforts: [
    { value: "minimal" },
    { value: "low" },
    { value: "medium" },
    { value: "high" },
  ],
};

const CURSOR_RUNTIME_MODEL_300K: ProviderModelDescriptor = {
  slug: "claude-opus-4-7",
  name: "Claude Opus 4.7",
  upstreamProviderId: "anthropic",
  upstreamProviderName: "Anthropic",
  supportedReasoningEfforts: [
    { value: "high", label: "High" },
    { value: "xhigh", label: "Extra High" },
  ],
  defaultReasoningEffort: "high",
  contextWindowOptions: [{ value: "300k", label: "300K", isDefault: true }],
  defaultContextWindow: "300k",
};

const PI_RUNTIME_MODEL_WITH_REASONING: ProviderModelDescriptor = {
  slug: "openai/gpt-5.5",
  name: "GPT-5.5",
  upstreamProviderId: "openai",
  upstreamProviderName: "OpenAI",
  supportedReasoningEfforts: [
    { value: "off", label: "Off" },
    { value: "medium", label: "Medium" },
    { value: "xhigh", label: "Extra High" },
  ],
  defaultReasoningEffort: "medium",
};

describe("getComposerProviderState", () => {
  it("returns null effort when no draft options or runtime metadata exist", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "gpt-5.4",
      prompt: "",
      modelOptions: undefined,
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: null,
      modelOptionsForDispatch: undefined,
    });
  });

  it("keeps explicit variant selections for dispatch", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "gpt-5.4",
      prompt: "",
      modelOptions: {
        opencode: {
          variant: "low",
        },
      },
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: null,
      modelOptionsForDispatch: {
        variant: "low",
      },
    });
  });

  it("drops empty option objects from dispatch", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "gpt-5.4",
      prompt: "",
      modelOptions: {
        opencode: {},
      },
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: null,
      modelOptionsForDispatch: undefined,
    });
  });

  it("uses the first runtime variant when no draft effort is selected", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "gpt-5.6-preview",
      runtimeModel: {
        slug: "gpt-5.6-preview",
        name: "GPT-5.6 Preview",
        supportsFastMode: true,
        supportedReasoningEfforts: [{ value: "low" }, { value: "medium" }, { value: "high" }],
        defaultReasoningEffort: "medium",
      },
      prompt: "",
      modelOptions: {
        opencode: {},
      },
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: "low",
      modelOptionsForDispatch: undefined,
    });
  });

  it("uses runtime metadata for models without fast-mode support", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "gpt-5.4-mini",
      runtimeModel: {
        slug: "gpt-5.4-mini",
        name: "GPT-5.4 Mini",
        supportedReasoningEfforts: [{ value: "low" }, { value: "medium" }, { value: "high" }],
        defaultReasoningEffort: "medium",
      },
      prompt: "",
      modelOptions: {
        opencode: {},
      },
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: "low",
      modelOptionsForDispatch: undefined,
    });
  });

  it("keeps explicit high variant selections on dispatch", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "gpt-5.4",
      prompt: "",
      modelOptions: {
        opencode: {
          variant: "high",
        },
      },
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: null,
      modelOptionsForDispatch: {
        variant: "high",
      },
    });
  });

  it("does not infer effort labels without runtime metadata", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "claude-sonnet-4-6",
      prompt: "",
      modelOptions: undefined,
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: null,
      modelOptionsForDispatch: undefined,
    });
  });

  it("keeps explicit variant selections even when the prompt mentions ultrathink", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "claude-sonnet-4-6",
      prompt: "Ultrathink:\nInvestigate this failure",
      modelOptions: {
        opencode: {
          variant: "medium",
        },
      },
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: null,
      modelOptionsForDispatch: {
        variant: "medium",
      },
    });
  });

  it("does not treat descriptor prompt-injected choices as legacy prompt-controlled efforts", () => {
    const selection = getComposerTraitSelection(
      "opencode",
      "claude-sonnet-4-6",
      "Ultrathink:\nInvestigate this",
      { variant: "ultrathink" },
      {
        slug: "claude-sonnet-4-6",
        name: "Claude Sonnet 4.6",
        optionDescriptors: [
          {
            id: "effort",
            label: "Effort",
            type: "select",
            promptInjectedValues: ["ultrathink"],
            options: [
              { id: "high", label: "High", isDefault: true },
              { id: "ultrathink", label: "Ultrathink" },
            ],
          },
        ],
      },
    );

    expect(selection.promptInjectedValues).toEqual([]);
    expect(selection.effort).toBeNull();
    expect(selection.ultrathinkPromptControlled).toBe(false);
  });

  it("keeps unsupported variant values on dispatch without a prompt label", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "claude-haiku-4-5",
      prompt: "",
      modelOptions: {
        opencode: {
          variant: "max",
        },
      },
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: null,
      modelOptionsForDispatch: {
        variant: "max",
      },
    });
  });

  it("drops empty Claude option objects from dispatch", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "claude-opus-4-6",
      prompt: "",
      modelOptions: {
        opencode: {},
      },
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: null,
      modelOptionsForDispatch: undefined,
    });
  });

  it("keeps explicit Claude variant selections on dispatch", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "claude-opus-4-6",
      prompt: "",
      modelOptions: {
        opencode: {
          variant: "high",
        },
      },
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: null,
      modelOptionsForDispatch: {
        variant: "high",
      },
    });
  });

  it("does not derive Gemini effort selections without runtime metadata", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "gemini-2.5-pro",
      prompt: "",
      modelOptions: {
        opencode: {},
      },
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: null,
      modelOptionsForDispatch: undefined,
    });
  });

  it("does not derive auto Gemini routing effort without runtime metadata", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "auto-gemini-2.5",
      prompt: "",
      modelOptions: {
        opencode: {},
      },
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: null,
      modelOptionsForDispatch: undefined,
    });
  });

  it("does not derive Gemini flash effort without runtime metadata", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "gemini-2.5-flash",
      prompt: "",
      modelOptions: {
        opencode: {},
      },
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: null,
      modelOptionsForDispatch: undefined,
    });
  });

  it("does not derive Gemini 3 thinking effort without runtime metadata", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "gemini-3.1-pro-preview",
      prompt: "",
      modelOptions: {
        opencode: {},
      },
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: null,
      modelOptionsForDispatch: undefined,
    });
  });

  it("keeps explicit Grok variant selections on dispatch", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "grok-build",
      prompt: "",
      modelOptions: {
        opencode: {
          variant: "high",
        },
      },
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: null,
      modelOptionsForDispatch: {
        variant: "high",
      },
    });
  });

  it("keeps explicit low Grok variant selections on dispatch", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "grok-build",
      prompt: "",
      modelOptions: {
        opencode: {
          variant: "low",
        },
      },
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: null,
      modelOptionsForDispatch: {
        variant: "low",
      },
    });
  });

  it("uses runtime metadata for Cursor context options", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "claude-opus-4-7",
      runtimeModel: CURSOR_RUNTIME_MODEL_300K,
      prompt: "",
      modelOptions: {
        opencode: {
          variant: "xhigh",
        },
      },
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: "xhigh",
      modelOptionsForDispatch: {
        variant: "xhigh",
      },
    });
  });

  it("keeps Pi runtime thinking selections on the variant field", () => {
    const selection = getComposerTraitSelection(
      "opencode",
      "openai/gpt-5.5",
      "",
      {},
      PI_RUNTIME_MODEL_WITH_REASONING,
    );
    const state = getComposerProviderState({
      provider: "opencode",
      model: "openai/gpt-5.5",
      runtimeModel: PI_RUNTIME_MODEL_WITH_REASONING,
      prompt: "",
      modelOptions: {
        opencode: {},
      },
    });

    expect(selection.primarySelectDescriptor?.id).toBe("variant");
    expect(selection.effort).toBe("off");
    expect(state).toEqual({
      provider: "opencode",
      promptEffort: "off",
      modelOptionsForDispatch: undefined,
    });
  });

  it("does not render a traits picker for OpenCode models without exposed controls", () => {
    const threadId = ThreadId.makeUnsafe("thread-opencode-traits-hidden");

    const picker = renderProviderTraitsPicker({
      provider: "opencode",
      threadId,
      model: "openrouter/gpt-oss-120b:free",
      modelOptions: undefined,
      prompt: "",
      includeFastMode: false,
      onPromptChange: vi.fn(),
    });

    const menuContent = renderProviderTraitsMenuContent({
      provider: "opencode",
      threadId,
      model: "openrouter/gpt-oss-120b:free",
      modelOptions: undefined,
      prompt: "",
      onPromptChange: vi.fn(),
    });

    expect(picker).toBeNull();
    expect(menuContent).toBeNull();
  });

  it("keeps OpenCode runtime thinking selections on the variant field", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "openai/gpt-5.4",
      runtimeModel: OPENCODE_RUNTIME_MODEL_WITH_REASONING,
      prompt: "",
      modelOptions: {
        opencode: {
          variant: "xhigh",
        },
      },
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: "xhigh",
      modelOptionsForDispatch: {
        variant: "xhigh",
      },
    });
  });

  it("uses the first runtime variant for OpenCode trigger state", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "openai/gpt-5.4",
      runtimeModel: OPENCODE_RUNTIME_MODEL_WITH_REASONING,
      prompt: "",
      modelOptions: undefined,
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: "none",
      modelOptionsForDispatch: undefined,
    });
  });

  it("falls back to the first OpenCode runtime variant when metadata omits a default", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "opencode/gpt-5-nano",
      runtimeModel: OPENCODE_RUNTIME_MODEL_WITHOUT_DEFAULT,
      prompt: "",
      modelOptions: undefined,
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: "minimal",
      modelOptionsForDispatch: undefined,
    });
  });

  it("renders OpenCode thinking controls when runtime metadata exposes levels without a default", () => {
    const threadId = ThreadId.makeUnsafe("thread-opencode-runtime-thinking");

    const picker = renderProviderTraitsPicker({
      provider: "opencode",
      threadId,
      model: "opencode/gpt-5-nano",
      runtimeModel: OPENCODE_RUNTIME_MODEL_WITHOUT_DEFAULT,
      modelOptions: undefined,
      prompt: "",
      includeFastMode: false,
      onPromptChange: vi.fn(),
    });

    const menuContent = renderProviderTraitsMenuContent({
      provider: "opencode",
      threadId,
      model: "opencode/gpt-5-nano",
      runtimeModel: OPENCODE_RUNTIME_MODEL_WITHOUT_DEFAULT,
      modelOptions: undefined,
      prompt: "",
      onPromptChange: vi.fn(),
    });

    expect(picker).not.toBeNull();
    expect(menuContent).not.toBeNull();
  });
});
