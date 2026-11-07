import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import backend from "@/lib/backend";
import type { activity, hydrants, inspection_plans } from "@/client";
import { useAuth } from "@/App";
import { COMMUNITY_TAP_MIN, COMMUNITY_TARGET_Q, HFSV_TARGET_Q } from "@/lib/targets";
import { PACE_LABEL, currentFyQuarter, multiStoryPeriod, pace, quarterTime, type Pace } from "@/lib/quarters";
import { TargetRing } from "@/components/targets/TargetParts";
import { cn } from "@/lib/utils";

// The watch's four targets as rings (Nov 2026) — the dashboard's at-a-glance
// version of the Targets page, with the same pace tick: HFSV and community for
// the financial quarter, multi-story for the same months on its own programme,
// hydrants for the calendar year.
// Replaces the Performance Summary card and the HFSV tile. Same queries as the
// Targets page, so the two always agree.

function yearTime(year: number) {
  const now = Date.now();
  const s = new Date(year, 0, 1).getTime();
  const e = new Date(year, 11, 31).getTime();
  return now < s ? { elapsed: 0, phase: "future" as const } : now > e ? { elapsed: 1, phase: "past" as const } : { elapsed: (now - s) / (e - s), phase: "now" as const };
}

function Ring({ label, done, target, p, note, to }: { label: string; done: number; target: number; p: Pace; note?: string; to: string }) {
  const word =
    p.state === "behind" || p.state === "late" ? `${p.behindBy} behind`
      : p.state === "none" ? "No target" : PACE_LABEL[p.state];
  return (
    <Link to={to} className="group flex min-w-0 flex-col items-center gap-1.5 rounded-xl p-1 text-center transition-colors hover:bg-muted/50">
      <TargetRing actual={done} target={target} pace={p} size={68} stroke={6}>
        <span className="font-mono text-sm font-semibold tabular-nums leading-none">
          {done}<span className="text-muted-foreground">/{target}</span>
        </span>
      </TargetRing>
      <span className="text-xs font-semibold">{label}</span>
      <span className={cn(
        "text-[11px] leading-tight",
        p.state === "late" || p.state === "missed" ? "font-semibold text-red-600 dark:text-red-400"
          : p.state === "behind" ? "font-semibold text-amber-700 dark:text-amber-400"
            : p.state === "done" ? "font-semibold text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
      )}>
        {word}
      </span>
      {note && <span className="text-[10.5px] text-muted-foreground">{note}</span>}
    </Link>
  );
}

export function TargetRings() {
  const { user } = useAuth();
  const watch = user?.watch_unit ?? "";
  const fq = currentFyQuarter();
  const t = quarterTime(fq);
  const year = new Date().getFullYear();
  const yt = yearTime(year);

  const [hf, cm, ms, hy] = useQueries({
    queries: [
      { queryKey: ["activities", "hfsv", watch, fq.fy, fq.q], queryFn: () => backend.activity.list({ type: "hfsv", watch, financial_year: fq.fy, quarter: fq.q }), enabled: !!watch },
      { queryKey: ["activities", "community", watch, fq.fy, fq.q], queryFn: () => backend.activity.list({ type: "community", watch, financial_year: fq.fy, quarter: fq.q }), enabled: !!watch },
      { queryKey: ["assignments", "multistory", watch, fq.fy, fq.q], queryFn: () => backend.inspection_plans.listAssignments({ plan_type: "multistory", watch, ...multiStoryPeriod(fq) }), enabled: !!watch },
      { queryKey: ["hydrants", "summary", year], queryFn: () => backend.hydrants.getHydrantSummary({ year }), enabled: !!watch },
    ],
  });
  if (!watch) return null;

  const hfDone = (hf.data as activity.ListActivitiesResponse | undefined)?.total_completed ?? 0;
  const cmData = cm.data as activity.ListActivitiesResponse | undefined;
  const cmDone = cmData?.total_completed ?? 0;
  const tap = cmData?.total_tap_completed ?? 0;
  const msData = ms.data as inspection_plans.ListAssignmentsResponse | undefined;
  const msDone = msData?.totals?.complete ?? 0;
  const msTotal = msDone + (msData?.totals?.pending ?? 0);
  const hyMine = (hy.data as hydrants.HydrantSummaryResponse | undefined)?.watches.find((w) => w.watch.toLowerCase() === watch.toLowerCase());

  return (
    <section aria-label="Targets" className="rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Targets</h2>
        <Link to="/targets" className="text-xs text-muted-foreground hover:text-foreground">
          {fq.label} · day {t.dayOf} of {t.totalDays} →
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-4">
        <Ring label="HFSV" done={hfDone} target={HFSV_TARGET_Q} p={pace(hfDone, HFSV_TARGET_Q, t.elapsed, t.phase)} to="/targets" />
        <Ring
          label="Community" done={cmDone} target={COMMUNITY_TARGET_Q} to="/targets"
          p={pace(cmDone, COMMUNITY_TARGET_Q, t.elapsed, t.phase, tap >= COMMUNITY_TAP_MIN)}
          note={`TAP ${tap}/${COMMUNITY_TAP_MIN}`}
        />
        <Ring label="Multi-story" done={msDone} target={msTotal} p={pace(msDone, msTotal, t.elapsed, t.phase)} to="/targets" />
        <Ring
          label="Hydrants" done={hyMine?.done ?? 0} target={hyMine?.total ?? 0} to="/hydrants"
          p={pace(hyMine?.done ?? 0, hyMine?.total ?? 0, yt.elapsed, yt.phase)}
          note={`${year} route`}
        />
      </div>
    </section>
  );
}
