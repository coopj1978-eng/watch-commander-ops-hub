import { useEffect, useState } from "react";

/**
 * True while the page is being read downwards.
 *
 * The phone's floating "+" buttons sit over the right edge of the page, which
 * is where cards keep their "→" links and rows keep their chips. So they step
 * aside while you scroll down, and come back as soon as you scroll up or reach
 * the top. Small wobbles of the thumb don't count.
 */
export function useScrollingDown(): boolean {
  const [down, setDown] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const y = window.scrollY;
        if (y < 40) setDown(false);
        else if (y - last > 12) setDown(true);
        else if (last - y > 12) setDown(false);
        else return;
        last = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return down;
}

/** Classes that tuck a floating button away (it stays reachable by keyboard). */
export const TUCKED_AWAY =
  "pointer-events-none translate-y-6 opacity-0 focus-visible:pointer-events-auto focus-visible:translate-y-0 focus-visible:opacity-100";
