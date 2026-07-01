// FILE: modelPrefs.ts
// Purpose: Favorite/recent model preferences (OpenChamber-style picker curation).
// Layer: Web settings helpers

import type { HiddenModelRef } from "./modelCatalogSettings";
import {
  hiddenModelKey,
  normalizeHiddenModelRefs,
  parseOpenCodeModelSlug,
} from "./modelCatalogSettings";

export const MAX_FAVORITE_MODELS = 32;
export const MAX_RECENT_MODELS = 8;

export function modelRefFromSlug(slug: string): HiddenModelRef | null {
  return parseOpenCodeModelSlug(slug);
}

export function favoriteModelSlugSet(refs: ReadonlyArray<HiddenModelRef>): ReadonlySet<string> {
  return new Set(refs.map((ref) => hiddenModelKey(ref)));
}

export function toggleFavoriteModelRef(
  refs: ReadonlyArray<HiddenModelRef>,
  ref: HiddenModelRef,
): HiddenModelRef[] {
  const key = hiddenModelKey(ref);
  const exists = refs.some((entry) => hiddenModelKey(entry) === key);
  if (exists) {
    return refs.filter((entry) => hiddenModelKey(entry) !== key);
  }
  const next = [{ ...ref }, ...refs.filter((entry) => hiddenModelKey(entry) !== key)];
  return normalizeHiddenModelRefs(next).slice(0, MAX_FAVORITE_MODELS);
}

export function pushRecentModelRef(
  refs: ReadonlyArray<HiddenModelRef>,
  ref: HiddenModelRef,
): HiddenModelRef[] {
  const key = hiddenModelKey(ref);
  const without = refs.filter((entry) => hiddenModelKey(entry) !== key);
  return normalizeHiddenModelRefs([ref, ...without]).slice(0, MAX_RECENT_MODELS);
}

export function pushRecentModelSlug(
  refs: ReadonlyArray<HiddenModelRef>,
  slug: string,
): HiddenModelRef[] {
  const ref = modelRefFromSlug(slug);
  if (!ref) {
    return normalizeHiddenModelRefs(refs);
  }
  return pushRecentModelRef(refs, ref);
}

export function toggleFavoriteModelSlug(
  refs: ReadonlyArray<HiddenModelRef>,
  slug: string,
): HiddenModelRef[] {
  const ref = modelRefFromSlug(slug);
  if (!ref) {
    return normalizeHiddenModelRefs(refs);
  }
  return toggleFavoriteModelRef(refs, ref);
}
