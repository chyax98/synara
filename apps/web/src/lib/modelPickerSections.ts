// FILE: modelPickerSections.ts
// Purpose: Persisted collapsed state for composer model picker accordions (OpenChamber-style).
// Layer: Web settings / picker state

export function collapsedModelPickerSectionSet(
  collapsedSections: readonly string[],
): ReadonlySet<string> {
  return new Set(
    collapsedSections.map((entry) => entry.trim()).filter((entry) => entry.length > 0),
  );
}

export function isModelPickerSectionCollapsed(
  collapsedSections: readonly string[],
  sectionKey: string,
): boolean {
  const key = sectionKey.trim();
  if (!key) {
    return false;
  }
  return collapsedModelPickerSectionSet(collapsedSections).has(key);
}

export function setModelPickerSectionCollapsed(
  collapsedSections: readonly string[],
  sectionKey: string,
  collapsed: boolean,
): string[] {
  const key = sectionKey.trim();
  if (!key) {
    return [...collapsedSections];
  }
  const next = new Set(collapsedModelPickerSectionSet(collapsedSections));
  if (collapsed) {
    next.add(key);
  } else {
    next.delete(key);
  }
  return Array.from(next);
}

export function toggleModelPickerSection(
  collapsedSections: readonly string[],
  sectionKey: string,
): string[] {
  const key = sectionKey.trim();
  if (!key) {
    return [...collapsedSections];
  }
  const collapsed = isModelPickerSectionCollapsed(collapsedSections, key);
  return setModelPickerSectionCollapsed(collapsedSections, key, !collapsed);
}
