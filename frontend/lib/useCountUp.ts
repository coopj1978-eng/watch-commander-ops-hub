import { useEffect, useRef, useState } from "react";

/**
 * A number that counts to its value when it arrives or changes (Home tiles,
 * Nov 2026). Starts from what's showing, eases out, and takes ~0.6s. With
 * "reduce motion" on it simply shows the value.
 */
export function useCountUp(target: number, ms = 650): number {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !Number.isFinite(target) || target === from.current) {
      from.current = target;
      setShown(target);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 4);
      const value = Math.round(a + (target - a) * eased);
      // Interrupted part-way (the value changed again): carry on from here.
      from.current = value;
      setShown(value);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);

  return shown;
}
