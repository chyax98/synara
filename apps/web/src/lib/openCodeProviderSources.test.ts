import { describe, expect, it } from "vitest";

import {
  formatOpenCodeProviderConfigSources,
  primaryOpenCodeProviderConfigPath,
  hasProviderConfigLayer,
  resolveDisconnectScopeOptions,
} from "./openCodeProviderSources";

describe("openCodeProviderSources", () => {
  it("formats layered source labels", () => {
    expect(
      formatOpenCodeProviderConfigSources({
        auth: { exists: true, path: "/data/auth.json" },
        user: { exists: true, path: "/user/opencode.json" },
        project: { exists: false, path: null },
        custom: { exists: false, path: null },
      }),
    ).toBe("认证凭据、用户配置");
  });

  it("prefers project path over user path", () => {
    expect(
      primaryOpenCodeProviderConfigPath({
        auth: { exists: false, path: null },
        user: { exists: true, path: "/user/opencode.json" },
        project: { exists: true, path: "/project/opencode.json" },
        custom: { exists: false, path: null },
      }),
    ).toBe("/project/opencode.json");
  });

  it("offers scope-aware disconnect options from provenance", () => {
    expect(
      resolveDisconnectScopeOptions({
        auth: { exists: true, path: "/auth.json" },
        user: { exists: false, path: null },
        project: { exists: true, path: "/project/opencode.json" },
        custom: { exists: false, path: null },
      }).map((entry) => entry.value),
    ).toEqual(["all", "auth", "project"]);
  });

  it("detects when any config layer exists for remove UI", () => {
    expect(
      hasProviderConfigLayer({
        auth: { exists: false, path: null },
        user: { exists: true, path: "/user/opencode.json" },
        project: { exists: false, path: null },
        custom: { exists: false, path: null },
      }),
    ).toBe(true);
  });
});
