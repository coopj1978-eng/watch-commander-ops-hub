import { cn } from "@/lib/utils";

interface MiniRingProps {
  /** 0–100 percentage to fill */
  value: number;
  /** SVG size in px (default 52) */
  size?: number;
  /** Stroke width in px (default 4) */
  strokeWidth?: number;
  /** Tailwind text-* colour class applied to the fill arc — uses currentColor */
  className?: string;
}

/**
 * Tiny animated SVG donut ring showing a percentage.
 * Colour is driven by a Tailwind `text-*` class via `currentColor`.
 * The fill animates with a 700 ms ease-out transition whenever `value` changes.
 */
export function MiniRing({ value, size = 52, strokeWidth = 4, className }: MiniRingProps) {
  const r            = (size - strokeWidth) / 2;
  const cx           = size / 2;
  const cy           = size / 2;
  const circumference = 2 * Math.PI * r;
  const clamped      = Math.min(Math.max(value, 0), 100);
  const offset       = circumference * (1 - clamped / 100);

  return (
    <svg width={size} height={size} className="shrink-0" aria-hidden="true">
      {/* Track */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted-foreground/15"
      />
      {/* Fill arc */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={String(circumference)}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: "stroke-dashoffset 700ms ease-out" }}
        className={cn(className)}
      />
    </svg>
  );
}
