import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// ──────────────────────────────────────────────────────────────────────────────
// OperationalStatusBar
//
// Horizontal five-cell summary pinned to the top of the WC dashboard. Values
// are deliberately read via useQuery calls that reuse the EXACT same
// queryKeys as the downstream widgets (WCStaffingWidget / WCTasksWidget);
// TanStack Query shares the cache across components with matching keys, so
// rendering this bar adds no extra network traffic.
//
// All five fields are typographically keyed: sans-serif labels + values,
// with IBM Plex Mono only on the numeric / reference portions (strength,
// active-task count, shift time window) where monospaced digits aid
// scannability.
// ──────────────────────────────────────────────────────────────────────────────

function getShiftSpan(): { label: string; time: string } {
  // Pure time-of-day shift detection — matches TopBar / WCCommandStrip /
  // WCShiftWidget. Day shift runs 08:00–18:00; everything else is night.
  const h = new Date().getHours();
  const isDay = h >= 8 && h < 18;
  return {
    label: isDay ? "Day Shift" : "Night Shift",
    time: isDay ? "08:00–18:00" : "18:00–08:00",
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Cell — single status item. Small uppercase label on top, value below.
// Skeleton is shown while loading.
// ──────────────────────────────────────────────────────────────────────────────

function StatusCell({
  label,
  value,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="px-4 py-3 min-w-0">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
        {label}
      </div>
      {loading ? (
        <Skeleton className="h-5 w-20 mt-1.5" />
      ) : (
        <div className="text-sm font-semibold text-foreground mt-1 truncate">
          {value}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main bar
// ──────────────────────────────────────────────────────────────────────────────

export function OperationalStatusBar() {
  const { user } = useAuth();
  const watch = user?.watch_unit ?? "";

  // ── Shared caches: same queryKeys as the widgets below ────────────────────
  const profilesQ = useQuery({
    queryKey: ["wc-profiles", watch],
    queryFn: async () => backend.profile.list({ watch: watch || undefined, limit: 200 }),
    enabled: true,
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

  const statsQ = useQuery({
    queryKey: ["wc-crew-stats"],
    queryFn: async () => backend.crew.getStats(),
  });

  // ── Derived values ───────────────────────────────────────────────────────
  const dateStr = new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const shift = getShiftSpan();

  // Strength — mirrors WCStaffingWidget derivation exactly
  const total = profilesQ.data?.total ?? 0;
  const absences = absencesQ.data?.absences ?? [];
  const watchUserIds = new Set((profilesQ.data?.profiles ?? []).map((p) => p.user_id));
  const watchAbsences = watch
    ? absences.filter((a) => watchUserIds.has(a.firefighter_id))
    : absences;
  const sickToday = watchAbsences.filter((a) => a.type === "sickness").length;
  const onLeaveToday = watchAbsences.filter((a) => a.type !== "sickness").length;
  const onDuty = Math.max(0, total - sickToday - onLeaveToday);

  // Active tasks — mirrors WCTasksWidget derivation (it uses the term "active"
  // for total_tasks - completed_tasks; we follow the same wording).
  const totalTasks = statsQ.data?.total_tasks ?? 0;
  const completedTasks = statsQ.data?.completed_tasks ?? 0;
  const activeTasks = Math.max(0, totalTasks - completedTasks);

  const strengthLoading = profilesQ.isLoading || absencesQ.isLoading;
  const tasksLoading = statsQ.isLoading;

  return (
    <Card className="border-t-2 border-t-indigo-500 overflow-hidden">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 divide-x divide-y md:divide-y-0 divide-border/40">
        <StatusCell label="Date" value={dateStr} />

        <StatusCell label="Watch" value={watch || "—"} />

        <StatusCell
          label="Shift"
          value={
            <>
              {shift.label}{" "}
              <span className="font-mono text-muted-foreground font-normal">
                {shift.time}
              </span>
            </>
          }
        />

        <StatusCell
          label="Strength"
          loading={strengthLoading}
          value={
            <span className="font-mono">
              {onDuty} / {total}
            </span>
          }
        />

        <StatusCell
          label="Tasks"
          loading={tasksLoading}
          value={
            <>
              <span className="font-mono">{activeTasks}</span>
              <span className="text-muted-foreground font-normal"> active</span>
            </>
          }
        />
      </div>
    </Card>
  );
}
