// FILE: useSettingsSearchHighlight.ts
// Purpose: Brief highlight pulse when settings search deep-links to a row (OpenChamber-style).
// Layer: Settings route hook

import { useEffect } from "react";

const HIGHLIGHT_MS = 1600;

export function useSettingsSearchHighlight(targetId: string | null): void {
  useEffect(() => {
    if (!targetId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const element = document.getElementById(targetId);
      if (!element) {
        return;
      }
      element.setAttribute("data-settings-search-highlight", "true");
      element.scrollIntoView({ block: "start", behavior: "smooth" });
      window.setTimeout(() => {
        element.removeAttribute("data-settings-search-highlight");
      }, HIGHLIGHT_MS);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [targetId]);
}
