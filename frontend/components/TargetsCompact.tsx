import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, ChevronRight } from "lucide-react";
import { getCurrentFinancialPeriod } from "@/lib/financialQuarter";

// ──────────────────────────────────────────────────────────────────────────────
// TargetsCompact — tight horizontal list of the current period's performance
// targets, modelled on the 'April targets' sidebar in the design refresh
// mockup but adapted to the SFRS quarterly financial-year model the app
// actually runs on.
//
// Each row: label · progress bar · {actual} / {target} · pace badge.
//
// Reuses the exact queryKeys the existing WCHFSVWidget, WCCommunityWidget,
// and WCMultiStoryWidget use — TanStack Query returns cached data, this
// component adds no network traffic when the old widgets are also on screen.
//
// Metrics shown (4 — limited to what we have real data for; the mockup's
// 'Training Certifications' and 'Local Property Visits' are fictional in
// the mockup and skipped here):
//   1. HFSV             — quarterly target 36, activity.list type=hfsv
//   2. High-Rise        — yearly target (from assignments data),
//                         inspection_plans.listAssignments type=multistory
//   3. Hydrant          — quarterly target 20, activity.list type=hydrant
//   4. Community Events — quarterly target 4,  activity.list type=community
// ──────────────────────────────────────────────────────────────────────────────

// Targets match those on /targets (Targets page). Source of truth for now.
const HFSV_TARGET_Q      = 36;
const HYDRANT_TARGET_Q   = 20;
const COMMUNITY_TARGET_Q = 4;

type Tone = "green" | "amber" | "red" | "muted";

function pctCss(tone: Tone): string {
  switch (tone) {
    case "green": return "bg-green-500";
    case "amber": return "bg-amber-500";
    case "red":   return "bg-red-500";
    case "muted": return "bg-muted-foreground/40";
  }
}

function pacePill(tone: Tone, label: string) {
  const cls =
    tone === "green"
      ? "text-green-700 bg-green-100 dark:bg-green-950/40 dark:text-green-300"
      : tone === "amber"
      ? "text-amber-700 bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
      : tone === "red"
      ? "text-red-700 bg-red-100 dark:bg-red-950/40 dark:text-red-300"
      : "text-muted-foreground bg-muted";
  return (
    <span className={`inline-flex shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

/** Given completion + target + day/total progress, return a tone + label. */
function computePace(actual: number, target: number, timePct: number): { tone: Tone; label: string } {
  if (target <= 0) return { tone: "muted", label: "No target" };
  if (actual >= target) return { tone: "green", label: "Complete" };

  const actualPct = actual / target;
  // Expected: at day X of Y, actual should be at least X/Y of target.
  if (actualPct >= timePct)        return { tone: "green", label: "On pace" };
  if (actualPct >= timePct * 0.75) return { tone: "amber", label: "Slightly behind" };
  return { tone: "red", label: "Behind" };
}

function TargetRow({
  label,
  actual,
  target,
  timePct,
  loading,
}: {
  label: string;
  actual: number;
  target: number;
  timePct: number;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div
        className="flex items-center gap-3 px-4"
        style={{ paddingBlock: "var(--pad-block)" }}
      >
        <Skeleton className="h-3 w-40" />
        <div className="flex-1"><Skeleton className="h-1.5 w-full" /></div>
        <Skeleton className="h-3 w-12" />
      </div>
    );
  }

  const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
  const pace = computePace(actual, target, timePct);

  return (
    <div
      className="flex items-center gap-3 px-4 hover:bg-muted/30 transition-colors"
      style={{ paddingBlock: "var(--pad-block)" }}
    >
      {/* Label — fixed width so the bars line up */}
      <span className="text-sm font-medium text-foreground w-44 shrink-0 truncate">
        {label}
      </span>

      {/* Progress bar — fills remaining horizontal space */}
      <div className="flex-1 min-w-0">
        <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`absolute left-0 top-0 bottom-0 ${pctCss(pace.tone)} transition-[width] duration-300`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Numbers + pace pill — mono for tabular alignment */}
      <span className="font-mono text-xs text-muted-foreground tabular-nums w-16 text-right shrink-0">
        {actual} / {target}
      </span>
      <div className="w-24 text-right shrink-0">
        {pacePill(pace.tone, pace.label)}
      </div>
    </div>
  );
}

export function TargetsCompact() {
  const { user } = useAuth();
  const watch = user?.watch_unit ?? "";
  const { financial_year, quarter, label: periodLabel } = getCurrentFinancialPeriod();
  const year = new Date().getFullYear();

  // Day-of-quarter / days-in-quarter — used for pace calculation.
  const now = new Date();
  // Financial quarter start months: Q1=Apr, Q2=Jul, Q3=Oct, Q4=Jan
  const qStartMonth = quarter === 1 ? 3 : quarter === 2 ? 6 : quarter === 3 ? 9 : 0;
  const qStartYear  = quarter === 4 ? financial_year + 1 : financial_year;
  const qStart = new Date(qStartYear, qStartMonth, 1);
  const qEnd   = new Date(qStartYear, qStartMonth + 3, 0); // last day of the 3rd month
  const qTotalDays   = Math.round((qEnd.getTime() - qStart.getTime()) / 86_400_000) + 1;
  const qElapsedDays = Math.max(1, Math.min(qTotalDays, Math.round((now.getTime() - qStart.getTime()) / 86_400_000) + 1));
  const qTimePct     = qElapsedDays / qTotalDays;

  // ── Shared caches ─────────────────────────────────────────────────────────
  const hfsvQ = useQuery({
    queryKey: ["wc-hfsv", watch, financial_year, quarter],
    queryFn: async () =>
      backend.activity.list({ type: "hfsv", watch: watch || undefined, financial_year, quarter }),
    enabled: !!watch,
  });

  const communityQ = useQuery({
    queryKey: ["wc-community", watch, financial_year, quarter],
    queryFn: async () =>
      backend.activity.list({ type: "community", watch: watch || undefined, financial_year, quarter }),
    enabled: !!watch,
  });

  const hydrantQ = useQuery({
    // Same endpoint pattern as WCHFSVWidget so one day, if a WCHydrantWidget
    // appears, it can share this cache.
    queryKey: ["wc-hydrant", watch, financial_year, quarter],
    queryFn: async () =>
      backend.activity.list({ type: "hydrant", watch: watch || undefined, financial_year, quarter }),
    enabled: !!watch,
  });

  const multistoryQ = useQuery({
    queryKey: ["wc-multistory", watch, year],
    queryFn: async () =>
      backend.inspection_plans.listAssignments({
        plan_type: "multistory",
        watch: watch || undefined,
        year,
      }),
    enabled: !!watch,
  });

  const hfsvActual      = hfsvQ.data?.total_completed ?? 0;
  const communityActual = communityQ.data?.total_completed ?? 0;
  const hydrantActual   = hydrantQ.data?.total_completed ?? 0;
  // Multistory has no explicit target field — its target is all assigned
  // inspections for the year, so we use complete + pending as the total.
  const msActual   = multistoryQ.data?.totals?.complete ?? 0;
  const msPending  = multistoryQ.data?.totals?.pending  ?? 0;
  const msTarget   = msActual + msPending;

  // For the yearly multistory metric, use day-of-year for the pace calc
  // instead of day-of-quarter so it matches its own time baseline.
  const yearStart       = new Date(now.getFullYear(), 0, 1);
  const yearEnd         = new Date(now.getFullYear(), 11, 31);
  const yearTotalDays   = Math.round((yearEnd.getTime() - yearStart.getTime()) / 86_400_000) + 1;
  const yearElapsedDays = Math.round((now.getTime() - yearStart.getTime()) / 86_400_000) + 1;
  const yearTimePct     = yearElapsedDays / yearTotalDays;

  return (
    <Card className="border-t-2 border-t-brand">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-brand" />
          <CardTitle className="text-sm font-medium">Performance Summary</CardTitle>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">
            {periodLabel} · Day{" "}
            <span className="tabular-nums">{qElapsedDays}</span>
            <span className="text-muted-foreground/60">/</span>
            <span className="tabular-nums">{qTotalDays}</span>
          </span>
          <Link
            to="/targets"
            className="flex items-center gap-0.5 hover:text-primary transition-colors"
          >
            View all <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="p-0 divide-y divide-border/40">
        <TargetRow
          label="HFSV Completions"
          actual={hfsvActual}
          target={HFSV_TARGET_Q}
          timePct={qTimePct}
          loading={hfsvQ.isLoading}
        />
        <TargetRow
          label="High-Rise Inspections"
          actual={msActual}
          target={msTarget || 0}
          timePct={yearTimePct}
          loading={multistoryQ.isLoading}
        />
        <TargetRow
          label="Hydrant Inspections"
          actual={hydrantActual}
          target={HYDRANT_TARGET_Q}
          timePct={qTimePct}
          loading={hydrantQ.isLoading}
        />
        <TargetRow
          label="Community Events"
          actual={communityActual}
          target={COMMUNITY_TARGET_Q}
          timePct={qTimePct}
          loading={communityQ.isLoading}
        />
      </CardContent>
    </Card>
  );
}
