import { describe, expect, it } from "vitest";

import { groupProviderModelOptionsWithPrefs } from "./providerModelOptions";

describe("groupProviderModelOptionsWithPrefs", () => {
  it("orders favorites, recent, then provider groups", () => {
    const options = [
      { slug: "openai/gpt-5", name: "GPT-5" },
      { slug: "anthropic/claude-sonnet-4", name: "Sonnet" },
      { slug: "google/gemini-2.5", name: "Gemini" },
    ];
    const grouped = groupProviderModelOptionsWithPrefs({
      options,
      favoriteSlugs: new Set(["anthropic/claude-sonnet-4"]),
      recentSlugs: ["openai/gpt-5", "anthropic/claude-sonnet-4"],
    });
    expect(grouped.map((group) => group.key)).toEqual([
      "__favorites__",
      "__recent__",
      "__ungrouped__",
    ]);
    expect(grouped[0]?.options.map((option) => option.slug)).toEqual(["anthropic/claude-sonnet-4"]);
    expect(grouped[1]?.options.map((option) => option.slug)).toEqual(["openai/gpt-5"]);
  });
});
