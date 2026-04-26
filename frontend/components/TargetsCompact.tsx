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

// Fallback constants — used when the targets DB has no row for the
// current quarter on a given metric. The actual displayed values come
// from backend.targets.list() (the source of truth that the /targets
// page reads from), so editing a target on /targets reflects on the
// dashboard widget without code changes.
const HFSV_TARGET_Q_DEFAULT      = 36;
const HYDRANT_TARGET_Q_DEFAULT   = 20;
const COMMUNITY_TARGET_Q_DEFAULT = 4;

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
      // Two-line layout on narrow containers (e.g. the dashboard right column
      // at ~380px) so the pace pill stays inside the card. Single-line on
      // sm+ where there's room to lay out everything horizontally. The bar +
      // pace pill move to a second row on narrow widths; numbers stay
      // on the title row.
      className="px-4 hover:bg-muted/30 transition-colors flex flex-wrap items-center gap-x-3 gap-y-1.5"
      style={{ paddingBlock: "var(--pad-block)" }}
    >
      {/* Label — flex-1 with truncate so it consumes available room without
          forcing the row wider than the container. */}
      <span className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">
        {label}
      </span>

      {/* Numbers — mono for tabular alignment. Stays on the title line. */}
      <span className="font-mono text-xs text-muted-foreground tabular-nums shrink-0">
        {actual} / {target}
      </span>

      {/* Pace pill — sits next to the numbers when there's room, drops to
          the next row alongside the progress bar when the container is
          narrower than the row's natural width. shrink-0 so it never
          truncates the "Behind" / "On track" text itself. */}
      <div className="shrink-0">{pacePill(pace.tone, pace.label)}</div>

      {/* Progress bar — basis-full forces it onto its own row below the
          label/numbers/pill, which keeps the row legible at any width and
          gives the bar the full container to fill. */}
      <div className="basis-full min-w-0">
        <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`absolute left-0 top-0 bottom-0 ${pctCss(pace.tone)} transition-[width] duration-300`}
            style={{ width: `${pct}%` }}
          />
        </div>
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

  // Quarter filter matches what TargetsDashboard does — without it we'd
  // pull the whole year's multi-story assignments and the user sees
  // "6 / 26" on the dashboard (year total) while the Targets page
  // shows "6 / 6 complete" (quarter total) for the same metric. Same
  // data, two different denominators — exactly the bug we're fixing.
  const multistoryQ = useQuery({
    queryKey: ["wc-multistory", watch, financial_year, quarter],
    queryFn: async () =>
      backend.inspection_plans.listAssignments({
        plan_type: "multistory",
        watch: watch || undefined,
        year,
        quarter,
      }),
    enabled: !!watch,
  });

  // Source-of-truth targets for the current period. /targets writes here,
  // nightly_rollup keeps actual_count fresh, and we read both to keep the
  // dashboard widget perfectly aligned with what the WC sees on the
  // Targets page. Falls back to the activity-rollup computed values when
  // a metric has no row for this period yet.
  const targetsQ = useQuery({
    queryKey: ["targets-for-quarter", financial_year, quarter],
    queryFn: () => backend.targets.list({ limit: 100 }),
  });

  // Filter is two-stage:
  //   1. Keep targets whose period STARTS within the current financial
  //      quarter — this discards year-spanning targets that also
  //      "overlap" the quarter and would otherwise compete for the
  //      same metric.
  //   2. Among multiple candidates per metric, prefer the shortest
  //      duration. If a WC has both a Q1-specific row AND a longer
  //      "first half" row, the Q1-specific one wins.
  //
  // Without (2) the widget was picking up a Multi-Story target with
  // target=10 (a year/half row that overlaps Q1) instead of the
  // quarter-scoped target=6 row the WC actually edited on /targets.
  const QUARTER_MS = 95 * 86_400_000; // ~3 months tolerance
  const periodTargets = (targetsQ.data?.targets ?? [])
    .filter((t: any) => {
      const start = new Date(t.period_start).getTime();
      const end = new Date(t.period_end).getTime();
      const startInQuarter =
        start >= qStart.getTime() && start <= qEnd.getTime();
      const isQuarterScoped = end - start <= QUARTER_MS;
      return startInQuarter && isQuarterScoped;
    })
    .sort((a: any, b: any) => {
      const aDur =
        new Date(a.period_end).getTime() - new Date(a.period_start).getTime();
      const bDur =
        new Date(b.period_end).getTime() - new Date(b.period_start).getTime();
      return aDur - bDur;
    });

  const findTarget = (metric: string) =>
    periodTargets.find((t: any) => t.metric === metric);

  const hfsvComputed      = hfsvQ.data?.total_completed ?? 0;
  const communityComputed = communityQ.data?.total_completed ?? 0;
  const hydrantComputed   = hydrantQ.data?.total_completed ?? 0;
  const msComputed        = multistoryQ.data?.totals?.complete ?? 0;
  const msPending         = multistoryQ.data?.totals?.pending  ?? 0;

  // Prefer the targets-table values; fall back to live-computed actuals
  // and the hardcoded defaults for missing rows.
  const hfsvRow      = findTarget("HFSV");
  const hydrantRow   = findTarget("Hydrants");
  const communityRow = findTarget("Activities");
  const msRow        = findTarget("HighRise");

  const hfsvActual      = hfsvRow?.actual_count      ?? hfsvComputed;
  const hfsvTarget      = hfsvRow?.target_count      ?? HFSV_TARGET_Q_DEFAULT;
  const hydrantActual   = hydrantRow?.actual_count   ?? hydrantComputed;
  const hydrantTarget   = hydrantRow?.target_count   ?? HYDRANT_TARGET_Q_DEFAULT;
  const communityActual = communityRow?.actual_count ?? communityComputed;
  const communityTarget = communityRow?.target_count ?? COMMUNITY_TARGET_Q_DEFAULT;
  const msActual        = msRow?.actual_count        ?? msComputed;
  const msTarget        = msRow?.target_count        ?? (msComputed + msPending);

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
          target={hfsvTarget}
          timePct={qTimePct}
          loading={hfsvQ.isLoading || targetsQ.isLoading}
        />
        <TargetRow
          label="Multi-Story Inspections"
          actual={msActual}
          target={msTarget || 0}
          timePct={qTimePct}
          loading={multistoryQ.isLoading || targetsQ.isLoading}
        />
        <TargetRow
          label="Hydrant Inspections"
          actual={hydrantActual}
          target={hydrantTarget}
          timePct={qTimePct}
          loading={hydrantQ.isLoading || targetsQ.isLoading}
        />
        <TargetRow
          label="Community Events"
          actual={communityActual}
          target={communityTarget}
          timePct={qTimePct}
          loading={communityQ.isLoading || targetsQ.isLoading}
        />
      </CardContent>
    </Card>
  );
}
