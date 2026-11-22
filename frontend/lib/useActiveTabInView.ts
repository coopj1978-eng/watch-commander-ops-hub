import { useEffect, useRef } from "react";

/**
 * For a row of tabs that scrolls sideways on a phone: slide it so the tab
 * you're on is in view. Give the row the returned ref and pass whatever says
 * which tab is active. Without it a page opened on its last tab ("Admin →
 * Users", "Shift → Rotas") showed the first few tabs and hid the one in use
 * (seen on an iPhone screen, 22 Nov 2026). Sideways only; the page stays put.
 *
 * The active tab is whichever carries data-state="active" (the shared Tabs),
 * aria-selected="true" or aria-current="page".
 */
export function useActiveTabInView<T extends HTMLElement = HTMLDivElement>(active: unknown) {
  const row = useRef<T>(null);
  useEffect(() => {
    const el = row.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const tab = el.querySelector<HTMLElement>('[data-state="active"], [aria-selected="true"], [aria-current="page"]');
    if (!tab) return;
    const t = tab.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (t.left >= r.left + 12 && t.right <= r.right - 12) return;
    el.scrollTo({ left: el.scrollLeft + t.left - r.left - 16 });
  }, [active]);
  return row;
}
