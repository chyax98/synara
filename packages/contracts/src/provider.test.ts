import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import { ProviderSendTurnInput, ProviderSessionStartInput } from "./provider";

const decodeProviderSessionStartInput = Schema.decodeUnknownSync(ProviderSessionStartInput);
const decodeProviderSendTurnInput = Schema.decodeUnknownSync(ProviderSendTurnInput);

describe("ProviderSessionStartInput", () => {
  it("accepts OpenCode payloads", () => {
    const parsed = decodeProviderSessionStartInput({
      threadId: "thread-1",
      provider: "opencode",
      cwd: "/tmp/workspace",
      modelSelection: {
        provider: "opencode",
        model: "openai/gpt-5",
        options: {
          variant: "default",
          agent: "build",
        },
      },
      runtimeMode: "full-access",
      providerOptions: {
        opencode: {
          binaryPath: "/usr/local/bin/opencode",
          serverUrl: "http://127.0.0.1:4096",
        },
      },
    });
    expect(parsed.runtimeMode).toBe("full-access");
    expect(parsed.modelSelection?.provider).toBe("opencode");
    expect(parsed.modelSelection?.model).toBe("openai/gpt-5");
    expect(parsed.modelSelection?.options?.variant).toBe("default");
    expect(parsed.modelSelection?.options?.agent).toBe("build");
    expect(parsed.providerOptions?.opencode?.binaryPath).toBe("/usr/local/bin/opencode");
    expect(parsed.providerOptions?.opencode?.serverUrl).toBe("http://127.0.0.1:4096");
  });

  it("rejects payloads without runtime mode", () => {
    expect(() =>
      decodeProviderSessionStartInput({
        threadId: "thread-1",
        provider: "opencode",
      }),
    ).toThrow();
  });
});

describe("ProviderSendTurnInput", () => {
  it("accepts OpenCode modelSelection", () => {
    const parsed = decodeProviderSendTurnInput({
      threadId: "thread-1",
      modelSelection: {
        provider: "opencode",
        model: "openai/gpt-5",
        options: {
          variant: "fast",
          agent: "plan",
        },
      },
    });

    expect(parsed.modelSelection?.provider).toBe("opencode");
    expect(parsed.modelSelection?.model).toBe("openai/gpt-5");
    expect(parsed.modelSelection?.options?.variant).toBe("fast");
    expect(parsed.modelSelection?.options?.agent).toBe("plan");
  });
});
