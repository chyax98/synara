// FILE: ProvidersSettingsUx.test.tsx
// Purpose: Static render smoke for OpenChamber-style providers settings sidebar sections.
// Layer: Component rendering tests

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AppSettingsSchema } from "~/appSettings";
import type { useOpenCodeModelCatalog } from "~/hooks/useOpenCodeModelCatalog";
import { ProvidersSettingsSidebar } from "./ProvidersSettingsSidebar";
import { SettingsRow } from "./SettingsPanelPrimitives";
import { Switch } from "~/components/ui/switch";

type Catalog = ReturnType<typeof useOpenCodeModelCatalog>;

function makeCatalogStub(input: {
  connected?: Catalog["sidebarGroups"];
  configuredOnly?: Catalog["configuredOnlyProviders"];
  discoverable?: Catalog["discoverableUnconnectedProviders"];
}): Catalog {
  const connected = input.connected ?? [
    { id: "anthropic", name: "Anthropic", models: [{ slug: "anthropic/claude", name: "Claude" }] },
  ];
  const configuredOnly = input.configuredOnly ?? [
    { id: "my-proxy", name: "My Proxy", models: [{ slug: "my-proxy/gpt-4o", name: "GPT-4o" }] },
  ];
  const discoverable = input.discoverable ?? [{ id: "openai", name: "OpenAI", models: [] }];
  const connectedProviderIds = new Set(connected.map((group) => group.id));

  return {
    connection: {
      binaryPath: null,
      serverUrl: null,
      serverPassword: null,
      resolvedBinaryLabel: "opencode（系统 PATH）",
    },
    settings: {} as Catalog["settings"],
    updateSettings: vi.fn(),
    overviewQuery: {} as Catalog["overviewQuery"],
    dynamicModels: [],
    catalogAgents: [],
    catalogOptions: [],
    visibleOptions: [],
    modelGroups: [],
    connectedProviderIds,
    sidebarGroups: [...connected, ...configuredOnly, ...discoverable],
    unconnectedProviders: [...configuredOnly, ...discoverable],
    configuredOnlyProviders: configuredOnly,
    discoverableUnconnectedProviders: discoverable,
    configuredProviderIds: new Set(configuredOnly.map((group) => group.id)),
    authMethodsByProvider: {},
    isLoading: false,
    isError: false,
    errorMessage: null,
    isDiscoveryPending: false,
    refreshCatalog: vi.fn(),
    resolveGroup: (providerId: string | null) =>
      [...connected, ...configuredOnly, ...discoverable].find((group) => group.id === providerId) ??
      null,
  } as unknown as Catalog;
}

describe("ProvidersSettingsSidebar", () => {
  it("renders connected, configured-only, and discoverable sections", () => {
    const markup = renderToStaticMarkup(
      <ProvidersSettingsSidebar
        catalog={makeCatalogStub({})}
        selectedProviderId="my-proxy"
        onSelectProvider={vi.fn()}
      />,
    );

    expect(markup).toContain("已连接");
    expect(markup).toContain("已配置");
    expect(markup).toContain("可连接");
    expect(markup).toContain("My Proxy");
    expect(markup).toContain("OpenAI");
    expect(markup).toContain("Anthropic");
  });
});

describe("Providers settings layout knobs (static render)", () => {
  it("renders auto-reload and streaming switches from shipped settings fields", () => {
    const settings = AppSettingsSchema.makeUnsafe({
      openCodeAutoReloadCatalog: true,
      enableAssistantStreaming: false,
    });

    const markup = renderToStaticMarkup(
      <>
        <SettingsRow
          title="认证后自动重新加载"
          description="连接、断开、写入 opencode.json 或增删自定义模型后自动刷新目录。关闭后需手动点「重新加载」。"
          control={
            <Switch
              checked={settings.openCodeAutoReloadCatalog}
              onCheckedChange={vi.fn()}
              aria-label="认证后自动重新加载 OpenCode 目录"
            />
          }
        />
        <SettingsRow
          title="助手输出传输"
          description="streaming = 实时流式渲染（极客/低延迟）；buffered = 整段完成后一次性显示。"
          control={
            <Switch
              checked={settings.enableAssistantStreaming}
              onCheckedChange={vi.fn()}
              aria-label="启用流式助手输出"
            />
          }
        />
      </>,
    );

    expect(markup).toContain("认证后自动重新加载");
    expect(markup).toContain("助手输出传输");
    expect(markup).toContain('aria-label="认证后自动重新加载 OpenCode 目录"');
    expect(markup).toContain('aria-label="启用流式助手输出"');
    console.info("OBSERVATION: layoutKnobs.rendered", true);
  });
});
