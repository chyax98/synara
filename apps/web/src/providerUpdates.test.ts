// FILE: providerUpdates.test.ts
// Purpose: Covers provider-update filtering shared by notifications and settings.
// Layer: Web utility tests
// Exports: Vitest suites for providerUpdates.ts

import type { ProviderKind, ServerProviderStatus, ServerSettings } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";

import {
  getVisibleProviderUpdateStatuses,
  isProviderUpdateActive,
  providerUpdateNotificationKey,
  shouldShowProviderUpdateStatus,
} from "./providerUpdates";

function providerStatus(
  provider: ProviderKind,
  overrides: Partial<ServerProviderStatus> = {},
): ServerProviderStatus {
  return {
    provider,
    status: "ready",
    available: true,
    authStatus: "authenticated",
    version: "1.0.0",
    checkedAt: "2026-06-10T10:00:00.000Z",
    versionAdvisory: {
      status: "behind_latest",
      currentVersion: "1.0.0",
      latestVersion: "1.1.0",
      updateCommand: "npm install -g provider@latest",
      canUpdate: true,
      checkedAt: "2026-06-10T10:00:00.000Z",
      message: "Update available.",
    },
    ...overrides,
  };
}

function serverSettings(overrides: Partial<ServerSettings["providers"]> = {}): ServerSettings {
  const provider = {
    enabled: true,
    binaryPath: "",
    serverUrl: "",
    serverPassword: "",
    experimentalWebSockets: false,
    customModels: [],
  };

  return {
    enableAssistantStreaming: false,
    defaultThreadEnvMode: "local",
    addProjectBaseDirectory: "",
    textGenerationModelSelection: { provider: "opencode", model: "openai/gpt-5" },
    providers: {
      opencode: { ...provider, binaryPath: "opencode" },
      ...overrides,
    },
    skills: { disabled: [] },
  };
}

describe("getVisibleProviderUpdateStatuses", () => {
  it("excludes providers hidden from Synara so unchecked providers do not nag", () => {
    const result = getVisibleProviderUpdateStatuses({
      providers: [providerStatus("opencode")],
      hiddenProviders: ["opencode"],
      serverSettings: serverSettings(),
    });

    expect(result).toEqual([]);
  });

  it("excludes server-disabled providers", () => {
    const result = getVisibleProviderUpdateStatuses({
      providers: [providerStatus("opencode")],
      serverSettings: serverSettings({
        opencode: {
          enabled: false,
          binaryPath: "opencode",
          serverUrl: "",
          serverPassword: "",
          experimentalWebSockets: false,
          customModels: [],
        },
      }),
    });

    expect(result).toEqual([]);
  });

  it("waits for server settings before showing provider updates", () => {
    const result = getVisibleProviderUpdateStatuses({
      providers: [providerStatus("opencode")],
      serverSettings: null,
    });

    expect(result).toEqual([]);
  });

  it("can narrow notifications to one-click updates while settings keep manual updates visible", () => {
    const manualOnly = providerStatus("opencode", {
      versionAdvisory: {
        status: "behind_latest",
        currentVersion: "1.0.0",
        latestVersion: "1.1.0",
        updateCommand: null,
        canUpdate: false,
        checkedAt: "2026-06-10T10:00:00.000Z",
        message: "Update available.",
      },
    });

    expect(
      getVisibleProviderUpdateStatuses({
        providers: [providerStatus("opencode"), manualOnly],
        serverSettings: serverSettings(),
      }).map((provider) => provider.provider),
    ).toEqual(["opencode", "opencode"]);
    expect(
      getVisibleProviderUpdateStatuses({
        providers: [providerStatus("opencode"), manualOnly],
        serverSettings: serverSettings(),
        oneClickOnly: true,
      }).map((provider) => provider.provider),
    ).toEqual(["opencode"]);
  });
});

describe("providerUpdateNotificationKey", () => {
  it("keys by provider/version and ignores ordering", () => {
    const left = providerUpdateNotificationKey([
      providerStatus("opencode", {
        versionAdvisory: {
          ...providerStatus("opencode").versionAdvisory!,
          latestVersion: "2.0.0",
        },
      }),
      providerStatus("opencode"),
    ]);
    const right = providerUpdateNotificationKey([
      providerStatus("opencode"),
      providerStatus("opencode", {
        versionAdvisory: {
          ...providerStatus("opencode").versionAdvisory!,
          latestVersion: "2.0.0",
        },
      }),
    ]);

    expect(left).toBe(right);
  });
});

describe("shouldShowProviderUpdateStatus", () => {
  it("matches the list filter for hidden and server-disabled providers", () => {
    const opencode = providerStatus("opencode");
    const settings = serverSettings({
      opencode: {
        enabled: false,
        binaryPath: "opencode",
        serverUrl: "",
        serverPassword: "",
        experimentalWebSockets: false,
        customModels: [],
      },
    });

    expect(
      shouldShowProviderUpdateStatus({
        provider: opencode,
        hiddenProviderSet: new Set(),
        serverSettings: settings,
      }),
    ).toBe(false);
    expect(
      shouldShowProviderUpdateStatus({
        provider: opencode,
        hiddenProviders: ["opencode"],
        serverSettings: serverSettings(),
      }),
    ).toBe(false);
  });
});

describe("isProviderUpdateActive", () => {
  it("treats queued and running update states as active", () => {
    const queuedState = {
      status: "queued" as const,
      message: null,
      startedAt: "2026-06-10T10:00:00.000Z",
      finishedAt: null,
      output: null,
    };
    const succeededState = {
      status: "succeeded" as const,
      message: null,
      startedAt: "2026-06-10T10:00:00.000Z",
      finishedAt: "2026-06-10T10:01:00.000Z",
      output: null,
    };

    expect(isProviderUpdateActive(providerStatus("opencode", { updateState: queuedState }))).toBe(
      true,
    );
    expect(
      isProviderUpdateActive(providerStatus("opencode", { updateState: succeededState })),
    ).toBe(false);
  });
});
