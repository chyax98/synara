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
  it("returns codex defaults when no codex draft options exist", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "gpt-5.4",
      prompt: "",
      modelOptions: undefined,
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: "high",
      modelOptionsForDispatch: undefined,
    });
  });

  it("normalizes codex dispatch options while preserving the selected effort", () => {
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
      promptEffort: "low",
      modelOptionsForDispatch: {
        variant: "low",
              },
    });
  });

  it("preserves codex fast mode when it is the only active option", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "gpt-5.4",
      prompt: "",
      modelOptions: {
        opencode: {
                  },
      },
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: "high",
      modelOptionsForDispatch: {
              },
    });
  });

  it("preserves codex fast mode for runtime-discovered models that advertise support", () => {
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
        opencode: {
                  },
      },
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: "medium",
      modelOptionsForDispatch: {
              },
    });
  });

  it("drops codex fast mode when runtime discovery does not advertise support", () => {
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
        opencode: {
                  },
      },
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: "medium",
      modelOptionsForDispatch: undefined,
    });
  });

  it("drops explicit codex default/off overrides from dispatch while keeping the selected effort label", () => {
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
      promptEffort: "high",
      modelOptionsForDispatch: undefined,
    });
  });

  it("returns Claude defaults for effort-capable models", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "claude-sonnet-4-6",
      prompt: "",
      modelOptions: undefined,
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: "high",
      modelOptionsForDispatch: undefined,
    });
  });

  it("tracks Claude ultrathink from the prompt without changing dispatch effort", () => {
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
      promptEffort: "medium",
      modelOptionsForDispatch: {
        variant: "medium",
      },
      composerFrameClassName: "ultrathink-frame",
      modelPickerIconClassName: "ultrathink-chroma",
    });
  });

  it("treats descriptor prompt-injected choices like legacy prompt-controlled efforts", () => {
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

    expect(selection.promptInjectedValues).toContain("ultrathink");
    expect(selection.effort).toBe("high");
    expect(selection.ultrathinkPromptControlled).toBe(true);
  });

  it("drops unsupported Claude effort options for models without effort controls", () => {
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
      modelOptionsForDispatch: undefined,
    });
  });

  it("preserves Claude fast mode when it is the only active option", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "claude-opus-4-6",
      prompt: "",
      modelOptions: {
        opencode: {
                  },
      },
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: "high",
      modelOptionsForDispatch: {
              },
    });
  });

  it("drops explicit Claude default/off overrides from dispatch while keeping the selected effort label", () => {
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
      promptEffort: "high",
      modelOptionsForDispatch: undefined,
    });
  });

  it("derives Gemini effort selections from the active model family", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "gemini-2.5-pro",
      prompt: "",
      modelOptions: {
        opencode: {
          
        },
      },
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: "512",
      modelOptionsForDispatch: {
        
      },
    });
  });

  it("drops unsupported Gemini off overrides for auto 2.5 routing", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "auto-gemini-2.5",
      prompt: "",
      modelOptions: {
        opencode: {
          
        },
      },
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: "-1",
      modelOptionsForDispatch: undefined,
    });
  });

  it("drops unsupported Gemini off overrides for 2.5 Flash", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "gemini-2.5-flash",
      prompt: "",
      modelOptions: {
        opencode: {
          
        },
      },
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: "-1",
      modelOptionsForDispatch: undefined,
    });
  });

  it("drops explicit Gemini default thinking overrides from dispatch", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "gemini-3.1-pro-preview",
      prompt: "",
      modelOptions: {
        opencode: {
          
        },
      },
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: "HIGH",
      modelOptionsForDispatch: undefined,
    });
  });

  it("normalizes Grok reasoning effort options for dispatch", () => {
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
      promptEffort: "high",
      modelOptionsForDispatch: {
        variant: "high",
      },
    });
  });

  it("drops explicit Grok default reasoning effort from dispatch", () => {
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
      promptEffort: "low",
      modelOptionsForDispatch: undefined,
    });
  });

  it("drops stale Cursor context options once runtime metadata is authoritative", () => {
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

  it("keeps Pi runtime thinking selections on the thinkingLevel field", () => {
    const selection = getComposerTraitSelection(
      "opencode",
      "openai/gpt-5.5",
      "",
      {  },
      PI_RUNTIME_MODEL_WITH_REASONING,
    );
    const state = getComposerProviderState({
      provider: "opencode",
      model: "openai/gpt-5.5",
      runtimeModel: PI_RUNTIME_MODEL_WITH_REASONING,
      prompt: "",
      modelOptions: {
        opencode: {
          
        },
      },
    });

    expect(selection.primarySelectDescriptor?.id).toBe("thinkingLevel");
    expect(selection.effort).toBe("xhigh");
    expect(state).toEqual({
      provider: "opencode",
      promptEffort: "xhigh",
      modelOptionsForDispatch: {
        
      },
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

  it("uses the runtime default thinking level for OpenCode trigger state", () => {
    const state = getComposerProviderState({
      provider: "opencode",
      model: "openai/gpt-5.4",
      runtimeModel: OPENCODE_RUNTIME_MODEL_WITH_REASONING,
      prompt: "",
      modelOptions: undefined,
    });

    expect(state).toEqual({
      provider: "opencode",
      promptEffort: "medium",
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
