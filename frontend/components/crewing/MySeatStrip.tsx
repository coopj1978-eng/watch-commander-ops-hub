import { CalendarOff, Clock3, MapPin, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MySeatLine } from "@/lib/mySeat";

// The crewing board's first line for a firefighter (Nov 2026): where you
// ride this shift, or that you don't. Wording in lib/mySeat.ts.

const TONE: Record<MySeatLine["tone"], { box: string; icon: string; Icon: typeof Truck }> = {
  riding:   { box: "border-brand/30 bg-brand/5",                       icon: "bg-brand/15 text-brand dark:text-brand-bright", Icon: Truck },
  detached: { box: "border-sky-300/70 bg-sky-500/5 dark:border-sky-800", icon: "bg-sky-500/15 text-sky-700 dark:text-sky-300", Icon: MapPin },
  off:      { box: "border-border bg-muted/40",                        icon: "bg-muted text-muted-foreground",                 Icon: CalendarOff },
  not:      { box: "border-border bg-card",                            icon: "bg-muted text-muted-foreground",                 Icon: Truck },
  unset:    { box: "border-dashed border-border bg-card",              icon: "bg-muted text-muted-foreground",                 Icon: Clock3 },
};

export function MySeatStrip({ line }: { line: MySeatLine }) {
  const t = TONE[line.tone];
  return (
    <div role="status" className={cn("flex items-center gap-3 rounded-xl border px-3.5 py-3", t.box)}>
      <span aria-hidden className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", t.icon)}>
        <t.Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-snug">{line.title}</p>
        {line.detail && <p className="text-xs leading-snug text-muted-foreground">{line.detail}</p>}
      </div>
    </div>
  );
}
