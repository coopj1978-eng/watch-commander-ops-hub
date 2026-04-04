import { cn } from "@/lib/utils";

interface Segment {
  value: number;
  /** Tailwind `bg-*` class for this segment's colour */
  className: string;
}

interface MiniBarProps {
  segments: Segment[];
  /** The denominator — bar fills proportionally against this */
  total: number;
  className?: string;
}

/**
 * Thin segmented bar (4 px tall) showing a proportional breakdown.
 * Each segment animates its width with a 700 ms ease-out transition.
 * Returns null when `total` is 0 or all segment values are 0.
 */
export function MiniBar({ segments, total, className }: MiniBarProps) {
  if (total <= 0) return null;

  return (
    <div
      className={cn("flex w-full overflow-hidden rounded-full bg-muted/30", className)}
      style={{ height: 4 }}
      aria-hidden="true"
    >
      {segments.map((seg, i) => {
        if (seg.value <= 0) return null;
        const pct = (seg.value / total) * 100;
        return (
          <div
            key={i}
            className={seg.className}
            style={{ width: `${pct}%`, transition: "width 700ms ease-out" }}
          />
        );
      })}
    </div>
  );
}
