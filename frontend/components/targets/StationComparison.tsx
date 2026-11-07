import { useQueries, useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import backend from "@/lib/backend";
import type { activity, inspection_plans } from "@/client";
import { cn } from "@/lib/utils";
import { COMMUNITY_TAP_MIN, COMMUNITY_TARGET_Q, HFSV_TARGET_Q } from "@/lib/targets";
import { multiStoryPeriod, pace, quarterTime, type FyQuarter, type Pace } from "@/lib/quarters";
import { WatchDot } from "@/components/WatchBadge";
import { BAR_COLOUR } from "./TargetParts";

// Every watch's targets side by side for one quarter — for WCs and CCs to see
// how the station is doing (John, Nov 2026). Fixed watch order, never ranked:
// it's a status board, not a league table. Tap a watch to open its cards.
// Shares query keys with the cards, so opening a watch is instant.

export const STATION_WATCHES = ["Red", "White", "Green", "Blue", "Amber"] as const;

interface Cell { done: number; target: number; p: Pace; extra?: string }

function MetricCell({ cell, label }: { cell: Cell; label: string }) {
  const pct = cell.target > 0 ? Math.min(100, (cell.done / cell.target) * 100) : 0;
  const behind = cell.p.state === "behind" || cell.p.state === "late" || cell.p.state === "missed";
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-xs sm:hidden">
        <span className="text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-sm font-semibold tabular-nums">
          {cell.target === 0 ? <span className="text-muted-foreground">—</span> : cell.done}
        </span>
        {cell.target > 0 && <span className="font-mono text-xs tabular-nums text-muted-foreground">/ {cell.target}</span>}
        {cell.extra && <span className="ml-auto text-[10px] font-medium text-muted-foreground">{cell.extra}</span>}
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-[width] duration-700", BAR_COLOUR[cell.p.state])} style={{ width: `${pct}%` }} />
      </div>
      <div className={cn("mt-1 h-4 text-[11px]", behind ? (cell.p.state === "behind" ? "text-amber-700 dark:text-amber-400" : "text-red-600 dark:text-red-400") : "text-muted-foreground")}>
        {cell.target === 0 ? "" : cell.p.state === "done" ? "Done" : behind ? `${cell.p.behindBy} behind` : cell.p.state === "upcoming" ? "" : "On pace"}
      </div>
    </div>
  );
}

export function StationComparison({
  fq, ownWatch, onPick,
}: { fq: FyQuarter; ownWatch: string; onPick: (watch: string) => void }) {
  const time = quarterTime(fq);
  const year = fq.start.getFullYear();
  const now = new Date();
  const yStart = new Date(year, 0, 1);
  const yEnd = new Date(year, 11, 31);
  const yPhase = now < yStart ? "future" : now > yEnd ? "past" : "now";
  const yElapsed = yPhase === "now" ? (now.getTime() - yStart.getTime()) / (yEnd.getTime() - yStart.getTime()) : yPhase === "past" ? 1 : 0;

  const results = useQueries({
    queries: STATION_WATCHES.flatMap((w) => [
      {
        queryKey: ["activities", "hfsv", w, fq.fy, fq.q],
        queryFn: () => backend.activity.list({ type: "hfsv", watch: w, financial_year: fq.fy, quarter: fq.q }),
      },
      {
        queryKey: ["activities", "community", w, fq.fy, fq.q],
        queryFn: () => backend.activity.list({ type: "community", watch: w, financial_year: fq.fy, quarter: fq.q }),
      },
      {
        queryKey: ["assignments", "multistory", w, fq.fy, fq.q],
        queryFn: () => backend.inspection_plans.listAssignments({ plan_type: "multistory", watch: w, ...multiStoryPeriod(fq) }),
      },
    ]),
  });
  const { data: hydrantYear } = useQuery({
    queryKey: ["hydrants", "summary", year],
    queryFn: () => backend.hydrants.getHydrantSummary({ year }),
  });

  const rows = STATION_WATCHES.map((w, i) => {
    const hf = results[i * 3].data as activity.ListActivitiesResponse | undefined;
    const cm = results[i * 3 + 1].data as activity.ListActivitiesResponse | undefined;
    const ms = results[i * 3 + 2].data as inspection_plans.ListAssignmentsResponse | undefined;
    const hy = hydrantYear?.watches.find((x) => x.watch === w);
    const hfDone = hf?.total_completed ?? 0;
    const cmDone = cm?.total_completed ?? 0;
    const tap = cm?.total_tap_completed ?? 0;
    const msDone = ms?.totals?.complete ?? 0;
    const msTotal = msDone + (ms?.totals?.pending ?? 0);
    const hyDone = hy?.done ?? 0;
    const hyTotal = hy?.total ?? 0;
    return {
      watch: w,
      hfsv: { done: hfDone, target: HFSV_TARGET_Q, p: pace(hfDone, HFSV_TARGET_Q, time.elapsed, time.phase) },
      community: {
        done: cmDone, target: COMMUNITY_TARGET_Q, extra: `TAP ${tap}/${COMMUNITY_TAP_MIN}`,
        p: pace(cmDone, COMMUNITY_TARGET_Q, time.elapsed, time.phase, tap >= COMMUNITY_TAP_MIN),
      },
      multistory: { done: msDone, target: msTotal, p: pace(msDone, msTotal, time.elapsed, time.phase) },
      hydrant: { done: hyDone, target: hyTotal, p: pace(hyDone, hyTotal, yElapsed, yPhase) },
    };
  });

  // Station totals add up each watch's own position, so the station is only
  // "behind" by what the watches are behind — not by rounding the sum.
  const sum = (k: "hfsv" | "community" | "multistory" | "hydrant") => {
    const done = rows.reduce((n, r) => n + r[k].done, 0);
    const target = rows.reduce((n, r) => n + r[k].target, 0);
    const el = k === "hydrant" ? yElapsed : time.elapsed;
    const ph = k === "hydrant" ? yPhase : time.phase;
    const p = pace(done, target, el, ph);
    const behindBy = rows.reduce((n, r) => n + r[k].p.behindBy, 0);
    const expected = rows.reduce((n, r) => n + r[k].p.expected, 0);
    if (p.state === "behind" || p.state === "late" || p.state === "on" || p.state === "ahead") {
      const state = behindBy === 0 ? (done > expected ? "ahead" : "on") : el > 0.75 ? "late" : "behind";
      return { done, target, p: { ...p, state, behindBy, expected } } as Cell;
    }
    return { done, target, p } as Cell;
  };
  const loading = results.some((r) => r.isLoading);
  const COLS = "sm:grid sm:grid-cols-[minmax(120px,1fr)_repeat(4,minmax(0,1.3fr))_20px] sm:items-center sm:gap-5";

  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold">Station · {fq.label} · {fq.months}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Every watch against an even pace through the quarter. Hydrants are the {year} route.</p>
        </div>
        {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
      </header>

      {/* Column heads (desktop) */}
      <div className={cn("hidden px-5 pt-3 text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground", COLS)}>
        <span>Watch</span><span>HFSV</span><span>Community</span><span>Multi-story</span><span>Hydrants</span><span />
      </div>

      <ul className="divide-y divide-border/60">
        {rows.map((r) => {
          const mine = r.watch.toLowerCase() === ownWatch.toLowerCase();
          return (
            <li key={r.watch}>
              <button
                type="button"
                onClick={() => onPick(r.watch)}
                className={cn("block w-full px-5 py-4 text-left transition-colors hover:bg-muted/40", mine && "bg-muted/30", COLS)}
              >
                <div className="mb-3 flex items-center gap-2 sm:mb-0">
                  <WatchDot watch={r.watch} />
                  <span className="font-medium">{r.watch}</span>
                  {mine && <span className="rounded-full bg-foreground px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-background">You</span>}
                  <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground sm:hidden" />
                </div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:contents">
                  <MetricCell cell={r.hfsv} label="HFSV" />
                  <MetricCell cell={r.community} label="Community" />
                  <MetricCell cell={r.multistory} label="Multi-story" />
                  <MetricCell cell={r.hydrant} label="Hydrants" />
                </div>
                <ChevronRight className="hidden h-4 w-4 text-muted-foreground sm:block" />
              </button>
            </li>
          );
        })}
        {/* Station total */}
        <li className={cn("bg-muted/40 px-5 py-4", COLS)}>
          <div className="mb-3 font-semibold sm:mb-0">Station</div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:contents">
            <MetricCell cell={sum("hfsv")} label="HFSV" />
            <MetricCell cell={sum("community")} label="Community" />
            <MetricCell cell={sum("multistory")} label="Multi-story" />
            <MetricCell cell={sum("hydrant")} label="Hydrants" />
          </div>
          <span />
        </li>
      </ul>
    </section>
  );
}
