import { useState, useEffect, useRef } from "react";

/**
 * Animates a number from 0 → `target` whenever `target` changes.
 * Uses an ease-out-cubic curve so it decelerates naturally near the end.
 *
 * @param target   The number to count up to
 * @param duration Animation duration in ms (default 700)
 */
export function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef   = useRef<number | null>(null);

  useEffect(() => {
    // Cancel any in-flight animation
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    if (target === 0) {
      setValue(0);
      return;
    }

    startRef.current = null;

    const tick = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;

      const elapsed = timestamp - startRef.current;
      const t       = Math.min(elapsed / duration, 1);
      // ease-out-cubic: fast start, gentle deceleration
      const eased   = 1 - Math.pow(1 - t, 3);

      setValue(Math.round(eased * target));

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}
