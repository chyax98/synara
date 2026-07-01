import { describe, expect, it } from "vitest";

import {
  MAX_FAVORITE_MODELS,
  MAX_RECENT_MODELS,
  pushRecentModelSlug,
  toggleFavoriteModelSlug,
} from "./modelPrefs";

describe("modelPrefs", () => {
  it("toggles favorites by slug and caps count", () => {
    const first = toggleFavoriteModelSlug([], "anthropic/claude-sonnet-4");
    expect(first).toEqual([{ providerID: "anthropic", modelID: "claude-sonnet-4" }]);

    const removed = toggleFavoriteModelSlug(first, "anthropic/claude-sonnet-4");
    expect(removed).toEqual([]);
  });

  it("pushes recent models most-recent-first with dedupe", () => {
    let recent = pushRecentModelSlug([], "openai/gpt-5");
    recent = pushRecentModelSlug(recent, "anthropic/claude-sonnet-4");
    recent = pushRecentModelSlug(recent, "openai/gpt-5");
    expect(recent).toEqual([
      { providerID: "openai", modelID: "gpt-5" },
      { providerID: "anthropic", modelID: "claude-sonnet-4" },
    ]);
  });

  it("enforces recent and favorite limits", () => {
    let favorites = toggleFavoriteModelSlug([], "a/m0");
    for (let index = 1; index < MAX_FAVORITE_MODELS + 4; index += 1) {
      favorites = toggleFavoriteModelSlug(favorites, `p/m${index}`);
    }
    expect(favorites.length).toBe(MAX_FAVORITE_MODELS);

    let recent = pushRecentModelSlug([], "a/m0");
    for (let index = 1; index < MAX_RECENT_MODELS + 4; index += 1) {
      recent = pushRecentModelSlug(recent, `p/m${index}`);
    }
    expect(recent.length).toBe(MAX_RECENT_MODELS);
  });
});
