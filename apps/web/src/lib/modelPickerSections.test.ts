import { describe, expect, it } from "vitest";

import {
  isModelPickerSectionCollapsed,
  setModelPickerSectionCollapsed,
  toggleModelPickerSection,
} from "./modelPickerSections";

describe("modelPickerSections", () => {
  it("tracks collapsed section keys", () => {
    expect(isModelPickerSectionCollapsed([], "provider:anthropic")).toBe(false);
    const collapsed = setModelPickerSectionCollapsed([], "provider:anthropic", true);
    expect(isModelPickerSectionCollapsed(collapsed, "provider:anthropic")).toBe(true);
    expect(toggleModelPickerSection(collapsed, "provider:anthropic")).toEqual([]);
  });
});
