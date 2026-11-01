import { Link } from "react-router-dom";
import { BookMarked } from "lucide-react";
import { useAuth } from "@/App";
import { nextChangeYear, periodLabel, referenceHolders, watchReferences } from "@/lib/referenceRota";
import { useReferences } from "@/lib/references";

// "Our reference" on the home screens (Nov 2026): the station reference this
// watch holds for the two-year block, the one it's secondary on (covering it
// when that reference's main watch is off), and when they move on.

export function OurReference() {
  const { user } = useAuth();
  const watch = user?.watch_unit ?? "";
  const year = new Date().getFullYear();
  const mine = watch ? watchReferences(watch, year) : null;
  const { data } = useReferences();
  if (!mine) return null;
  const title = (ref: number) => data?.find((r) => r.ref === ref)?.title;
  const coverFor = referenceHolders(mine.secondary, year).main;

  return (
    <section aria-label="Our reference" className="rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><BookMarked className="h-4 w-4 text-muted-foreground" /> Our reference</h2>
        <span className="font-mono text-[11px] text-muted-foreground">{periodLabel(year)}</span>
      </div>
      <Link to={`/references#ref-${mine.main}`} className="mt-3 flex items-start gap-3 rounded-xl p-1 hover:bg-muted/50">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-foreground font-mono text-lg font-semibold text-background">{mine.main}</span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">Reference {mine.main}</span>
          <span className="block text-xs text-muted-foreground">{title(mine.main) ?? `${watch} Watch's main reference`}</span>
        </span>
      </Link>
      <Link to={`/references#ref-${mine.secondary}`} className="mt-1 flex items-start gap-3 rounded-xl p-1 hover:bg-muted/50">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border font-mono text-lg font-semibold">{mine.secondary}</span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">Secondary: Reference {mine.secondary}</span>
          <span className="block text-xs text-muted-foreground">
            {title(mine.secondary) ? `${title(mine.secondary)} — ` : ""}covers it when {coverFor} Watch is off
          </span>
        </span>
      </Link>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <span>Moves to Reference {(mine.main % 5) + 1} on 1 Jan {nextChangeYear(year)}</span>
        <Link to="/references" className="font-medium text-brand hover:underline">All references →</Link>
      </div>
    </section>
  );
}
