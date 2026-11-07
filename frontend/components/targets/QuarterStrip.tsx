import { useQueries } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import backend from "@/lib/backend";
import type { activity, inspection_plans } from "@/client";
import { cn } from "@/lib/utils";
import { COMMUNITY_TAP_MIN, COMMUNITY_TARGET_Q, HFSV_TARGET_Q } from "@/lib/targets";
import { currentFyQuarter, fyLabel, fyQuarter, multiStoryPeriod, pace, quarterTime, type QuarterNo } from "@/lib/quarters";
import { BAR_COLOUR } from "./TargetParts";

// The year as four quarter tiles: each shows HFSV, community and multi-story
// progress, and picking one switches the cards below to that quarter. Replaces
// the old Year at a Glance table and Period Selection card. Uses the same
// query keys as the cards, so the selected quarter costs nothing extra.

const QS: QuarterNo[] = [1, 2, 3, 4];

export function QuarterStrip({
  watch, fy, selected, onSelect, onFy,
}: {
  watch: string; fy: number; selected: QuarterNo; onSelect: (q: QuarterNo) => void; onFy: (fy: number) => void;
}) {
  const now = currentFyQuarter();

  const results = useQueries({
    queries: QS.flatMap((q) => [
      {
        queryKey: ["activities", "hfsv", watch, fy, q],
        queryFn: () => backend.activity.list({ type: "hfsv", watch: watch || undefined, financial_year: fy, quarter: q }),
        enabled: !!watch,
      },
      {
        queryKey: ["activities", "community", watch, fy, q],
        queryFn: () => backend.activity.list({ type: "community", watch: watch || undefined, financial_year: fy, quarter: q }),
        enabled: !!watch,
      },
      {
        queryKey: ["assignments", "multistory", watch, fy, q],
        queryFn: () => backend.inspection_plans.listAssignments({ plan_type: "multistory", watch: watch || undefined, ...multiStoryPeriod(fyQuarter(fy, q)) }),
        enabled: !!watch,
      },
    ]),
  });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="eyebrow">Financial year{watch ? ` · ${watch} Watch` : ""}</div>
        <div className="flex items-center gap-1">
          <button onClick={() => onFy(fy - 1)} className="grid h-7 w-7 place-items-center rounded-md hover:bg-muted" aria-label="Previous year">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[64px] text-center font-mono text-sm font-semibold tabular-nums">{fyLabel(fy)}</span>
          <button
            onClick={() => onFy(fy + 1)}
            disabled={fy >= now.fy}
            className="grid h-7 w-7 place-items-center rounded-md hover:bg-muted disabled:opacity-30"
            aria-label="Next year"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 [scrollbar-width:none]">
        {QS.map((q, i) => {
          const fq = fyQuarter(fy, q);
          const time = quarterTime(fq);
          const hf = results[i * 3].data as activity.ListActivitiesResponse | undefined;
          const cm = results[i * 3 + 1].data as activity.ListActivitiesResponse | undefined;
          const ms = results[i * 3 + 2].data as inspection_plans.ListAssignmentsResponse | undefined;
          const msDone = ms?.totals?.complete ?? 0;
          const msTotal = msDone + (ms?.totals?.pending ?? 0);
          const rows = [
            { k: "HFSV", done: hf?.total_completed ?? 0, target: HFSV_TARGET_Q, extra: true },
            { k: "Community", done: cm?.total_completed ?? 0, target: COMMUNITY_TARGET_Q, extra: (cm?.total_tap_completed ?? 0) >= COMMUNITY_TAP_MIN },
            { k: "Multi-story", done: msDone, target: msTotal, extra: true },
          ];
          const isNow = fy === now.fy && q === now.q;
          const isSel = q === selected;
          return (
            <button
              key={q}
              type="button"
              onClick={() => onSelect(q)}
              aria-pressed={isSel}
              className={cn(
                "group min-w-[220px] snap-start rounded-2xl border bg-card p-4 text-left transition-all sm:min-w-0",
                isSel ? "border-foreground shadow-md ring-1 ring-foreground" : "border-border/70 hover:border-foreground/30 hover:shadow-sm",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <span className="text-lg font-semibold">Q{q}</span>
                  <span className="ml-2 text-sm text-muted-foreground">{fq.months}</span>
                </div>
                {isNow ? (
                  <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-background">Now</span>
                ) : time.phase === "future" ? (
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Upcoming</span>
                ) : null}
              </div>
              <div className="mt-3 space-y-2">
                {rows.map((r) => {
                  const p = pace(r.done, r.target, time.elapsed, time.phase, r.extra);
                  const pct = r.target > 0 ? Math.min(100, (r.done / r.target) * 100) : 0;
                  return (
                    <div key={r.k}>
                      <div className="flex items-baseline justify-between text-[11px]">
                        <span className="text-muted-foreground">{r.k}</span>
                        <span className="font-mono tabular-nums">
                          {r.target === 0 ? <span className="text-muted-foreground">—</span> : `${r.done}/${r.target}`}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full transition-[width] duration-700", BAR_COLOUR[p.state])} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
