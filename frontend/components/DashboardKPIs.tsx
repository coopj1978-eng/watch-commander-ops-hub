import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentFinancialPeriod } from "@/lib/financialQuarter";

// ──────────────────────────────────────────────────────────────────────────────
// DashboardKPIs — tight 4-tile row pinned above the "Operational Status"
// section, matching the KPI row in the design refresh mockup.
//
// Every tile pulls from existing query caches (same queryKeys as WCTasksWidget,
// WCHFSVWidget, WCStaffingWidget, WCSicknessAlertsWidget). Rendering this row
// adds zero network traffic.
//
// What's deliberately missing vs the mockup:
//   - No sparklines. We have no historical series endpoint.
//   - No "+3 vs last shift" trend deltas. Same reason.
// Adding those requires new backend endpoints and is parked for a later pass.
// ──────────────────────────────────────────────────────────────────────────────

const HFSV_TARGET = 36;

type Tone = "default" | "alert";

function KPITile({
  label,
  value,
  unit,
  detail,
  tone = "default",
  loading,
  href,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  detail?: React.ReactNode;
  tone?: Tone;
  loading?: boolean;
  href?: string;
}) {
  const toneCls =
    tone === "alert"
      ? "border-red-500/60 bg-red-50/40 dark:bg-red-950/15"
      : "";

  const body = (
    <CardContent
      className="px-4 space-y-1"
      style={{ paddingBlock: "var(--pad-block)" }}
    >
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
        {label}
      </div>
      {loading ? (
        <Skeleton className="h-9 w-20 mt-1" />
      ) : (
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className="text-3xl font-bold font-mono tabular-nums leading-none">
            {value}
          </span>
          {unit && (
            <span className="text-sm text-muted-foreground font-normal">
              {unit}
            </span>
          )}
        </div>
      )}
      {!loading && detail && (
        <div className="text-xs text-muted-foreground pt-1 truncate">{detail}</div>
      )}
    </CardContent>
  );

  if (href) {
    return (
      <Link to={href} className="group">
        <Card className={`${toneCls} transition-colors hover:bg-muted/40`}>
          {body}
        </Card>
      </Link>
    );
  }

  return <Card className={toneCls}>{body}</Card>;
}

export function DashboardKPIs() {
  const { user } = useAuth();
  const watch = user?.watch_unit ?? "";
  const { financial_year, quarter, label: hfsvPeriodLabel } = getCurrentFinancialPeriod();

  // ── Shared caches: same queryKeys as the widgets below ────────────────────
  const statsQ = useQuery({
    queryKey: ["wc-crew-stats"],
    queryFn: async () => backend.crew.getStats(),
  });

  const hfsvQ = useQuery({
    queryKey: ["wc-hfsv", watch, financial_year, quarter],
    queryFn: async () =>
      backend.activity.list({
        type: "hfsv",
        watch: watch || undefined,
        financial_year,
        quarter,
      }),
    enabled: !!watch,
  });

  const profilesQ = useQuery({
    queryKey: ["wc-profiles", watch],
    queryFn: async () => backend.profile.list({ watch: watch || undefined, limit: 200 }),
  });

  const absencesQ = useQuery({
    queryKey: ["wc-absences-today"],
    queryFn: async () =>
      backend.absence.list({
        status: "approved",
        start_date: new Date().toISOString().split("T")[0],
        end_date: new Date().toISOString().split("T")[0],
        limit: 200,
      }),
  });

  const sicknessQ = useQuery({
    queryKey: ["wc-sickness-triggers"],
    queryFn: async () => backend.profile.list({ limit: 200 }),
  });

  const skillsQ = useQuery({
    queryKey: ["wc-skills-expiring"],
    queryFn: async () => backend.skill.listExpiring(),
  });

  // ── Tasks ──────────────────────────────────────────────────────────────────
  const totalTasks      = statsQ.data?.total_tasks ?? 0;
  const completedTasks  = statsQ.data?.completed_tasks ?? 0;
  const overdueTasks    = statsQ.data?.overdue_tasks ?? 0;
  const activeTasks     = Math.max(0, totalTasks - completedTasks);
  const tasksDetail = (
    <>
      <span className="font-mono">{completedTasks}</span> done
      {overdueTasks > 0 && (
        <>
          {" · "}
          <span className="font-mono text-red-600 dark:text-red-400">{overdueTasks}</span>
          <span className="text-red-600 dark:text-red-400"> overdue</span>
        </>
      )}
    </>
  );

  // ── HFSV ───────────────────────────────────────────────────────────────────
  const hfsvCompleted = hfsvQ.data?.total_completed ?? 0;
  const hfsvPct = HFSV_TARGET > 0 ? Math.round((hfsvCompleted / HFSV_TARGET) * 100) : 0;
  const hfsvDetail = (
    <>
      <span className="font-mono">{hfsvPct}%</span>
      {" · "}
      <span className={hfsvPct >= 75 ? "text-green-600 dark:text-green-500" : hfsvPct >= 40 ? "" : "text-amber-600 dark:text-amber-500"}>
        {hfsvPct >= 75 ? "on track" : hfsvPct >= 40 ? "in progress" : "behind pace"}
      </span>
      <span className="text-muted-foreground/70"> · {hfsvPeriodLabel}</span>
    </>
  );

  // ── Absence today ──────────────────────────────────────────────────────────
  const profiles = profilesQ.data?.profiles ?? [];
  const absences = absencesQ.data?.absences ?? [];
  const watchIds = new Set(profiles.map((p) => p.user_id));
  const watchAbsences = watch ? absences.filter((a) => watchIds.has(a.firefighter_id)) : absences;
  const sickToday = watchAbsences.filter((a) => a.type === "sickness").length;
  const leaveToday = watchAbsences.filter((a) => a.type !== "sickness").length;
  const absenceTotal = sickToday + leaveToday;
  const absenceDetail = (
    <>
      <span className="font-mono">{sickToday}</span> sick
      {" · "}
      <span className="font-mono">{leaveToday}</span> leave
    </>
  );

  // ── Alerts ─────────────────────────────────────────────────────────────────
  // Aggregates the WC-facing warning signals: stage-3 sickness triggers,
  // overdue tasks, expired certifications. Mirrors (a subset of) what
  // WCAlertBanner shows but as a single count.
  const stage3 = (sicknessQ.data?.profiles ?? []).filter((p) => p.trigger_stage === "Stage3").length;
  const expiredCerts = skillsQ.data?.expired_count ?? 0;
  const alertCount = stage3 + overdueTasks + expiredCerts;
  const alertDetail = alertCount === 0 ? (
    <span className="text-green-600 dark:text-green-500">All clear</span>
  ) : (
    <>
      {stage3 > 0 && (
        <>
          <span className="font-mono">{stage3}</span> stage-3
        </>
      )}
      {stage3 > 0 && (overdueTasks > 0 || expiredCerts > 0) && " · "}
      {overdueTasks > 0 && (
        <>
          <span className="font-mono">{overdueTasks}</span> overdue
        </>
      )}
      {overdueTasks > 0 && expiredCerts > 0 && " · "}
      {expiredCerts > 0 && (
        <>
          <span className="font-mono">{expiredCerts}</span> expired
        </>
      )}
    </>
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KPITile
        label="Tasks on Watch"
        loading={statsQ.isLoading}
        value={activeTasks}
        unit="open"
        detail={tasksDetail}
        href="/tasks"
      />

      <KPITile
        label="HFSV This Quarter"
        loading={hfsvQ.isLoading}
        value={hfsvCompleted}
        unit={`/ ${HFSV_TARGET}`}
        detail={hfsvDetail}
        href="/targets"
      />

      <KPITile
        label="Absence Today"
        loading={profilesQ.isLoading || absencesQ.isLoading}
        value={absenceTotal}
        unit={absenceTotal === 1 ? "person" : "people"}
        detail={absenceDetail}
        href="/people"
      />

      <KPITile
        label="Alerts"
        tone={alertCount > 0 ? "alert" : "default"}
        loading={sicknessQ.isLoading || skillsQ.isLoading}
        value={alertCount}
        unit="open"
        detail={alertDetail}
      />
    </div>
  );
}
