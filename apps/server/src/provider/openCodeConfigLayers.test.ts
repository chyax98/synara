import { existsSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  getOpenCodeProviderConfigSources,
  removeOpenCodeProviderConfig,
} from "./openCodeConfigLayers.ts";

describe("getOpenCodeProviderConfigSources", () => {
  let projectDir: string | null = null;

  afterEach(async () => {
    if (projectDir) {
      await rm(projectDir, { recursive: true, force: true });
      projectDir = null;
    }
  });

  it("detects provider entries in project opencode.json", async () => {
    projectDir = await mkdtemp(join(tmpdir(), "synara-opencode-layers-"));
    writeFileSync(
      join(projectDir, "opencode.json"),
      JSON.stringify({
        provider: {
          anthropic: { models: { "claude-sonnet-4": { name: "Sonnet" } } },
        },
      }),
    );

    const sources = getOpenCodeProviderConfigSources({
      providerId: "anthropic",
      cwd: projectDir,
    });
    expect(sources.project.exists).toBe(true);
    expect(sources.project.path).toContain("opencode.json");
  });

  it("removes provider entries from project opencode.json", async () => {
    projectDir = await mkdtemp(join(tmpdir(), "synara-opencode-layers-"));
    const configPath = join(projectDir, "opencode.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        provider: {
          anthropic: { models: { "claude-sonnet-4": { name: "Sonnet" } } },
        },
      }),
    );

    const removed = removeOpenCodeProviderConfig({
      providerId: "anthropic",
      cwd: projectDir,
      scope: "project",
    });
    expect(removed).toBe(true);
    const sources = getOpenCodeProviderConfigSources({
      providerId: "anthropic",
      cwd: projectDir,
    });
    expect(sources.project.exists).toBe(false);
    expect(existsSync(configPath)).toBe(false);
    console.info("OBSERVATION: removeProviderConfig.unlinkedProjectFile", !existsSync(configPath));
  });

  it("reads provider entries from opencode.jsonc with comments", async () => {
    projectDir = await mkdtemp(join(tmpdir(), "synara-opencode-layers-"));
    writeFileSync(
      join(projectDir, "opencode.jsonc"),
      `{
        // project override
        "provider": {
          "anthropic": { "models": { "claude-sonnet-4": { "name": "Sonnet" } } }
        }
      }`,
    );

    const sources = getOpenCodeProviderConfigSources({
      providerId: "anthropic",
      cwd: projectDir,
    });
    expect(sources.project.exists).toBe(true);
  });
});
