import { cn } from "@/lib/utils";
import type { NavBadge as Badge } from "@/lib/navBadges";

// A menu item's live count: a small pill beside the label, or a dot on the
// icon where there's no room for a number (the collapsed rail, phone tabs).

const pill = {
  // On the near-black sidebar
  dark: {
    alert: "bg-red-500 text-white",
    warn: "bg-amber-400 text-neutral-950",
    neutral: "bg-white/10 text-white/70",
  },
  // On the page background
  light: {
    alert: "bg-red-500 text-white",
    warn: "bg-amber-400 text-neutral-950",
    neutral: "bg-muted text-muted-foreground",
  },
} as const;

const dot = {
  alert: "bg-red-500",
  warn: "bg-amber-400",
  neutral: "bg-brand dark:bg-brand-bright",
} as const;

export function NavCount({ badge, on = "light", className }: { badge: Badge; on?: "dark" | "light"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5",
        "font-mono text-[10.5px] font-semibold tabular-nums leading-none",
        pill[on][badge.tone],
        className,
      )}
      title={badge.hint}
    >
      {badge.count > 99 ? "99+" : badge.count}
      <span className="sr-only"> — {badge.hint}</span>
    </span>
  );
}

export function NavDot({ badge, ring = "ring-neutral-900", className }: { badge: Badge; ring?: string; className?: string }) {
  return (
    <span
      className={cn("absolute h-2.5 w-2.5 rounded-full ring-2", dot[badge.tone], ring, className)}
      title={badge.hint}
      aria-label={badge.hint}
    />
  );
}
