import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import backend from "@/lib/backend";
import { useAuth } from "@/App";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CalendarCheck,
  ClipboardCheck,
  ShieldAlert,
  UserX,
  XCircle,
  MessageSquare,
  Flame,
} from "lucide-react";
import { isBefore, parseISO, startOfDay } from "date-fns";
import { crewingShiftFor } from "@/lib/shiftRota";
import { useSickOn } from "@/lib/absences";



// ── Types ──────────────────────────────────────────────────────────────────────

type Severity = "critical" | "warning" | "info";

interface AlertItem {
  id: string;
  severity: Severity;
  Icon: React.ElementType;
  label: string;
  count: number;
  href: string;
  /** People the alert is about — each links to their profile. */
  people?: { id: string; name: string }[];
}

// ── Severity styling ───────────────────────────────────────────────────────────

const countText: Record<Severity, string> = {
  critical: "text-red-600 dark:text-red-400",
  warning:  "text-amber-600 dark:text-amber-400",
  info:     "text-yellow-600 dark:text-yellow-400",
};

const rail: Record<Severity, string> = {
  critical: "bg-red-500",
  warning:  "bg-amber-500",
  info:     "bg-sky-500",
};

const tile: Record<Severity, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  warning:  "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  info:     "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
};

const rowHover: Record<Severity, string> = {
  critical: "hover:bg-red-50/60 dark:hover:bg-red-900/10",
  warning:  "hover:bg-amber-50/60 dark:hover:bg-amber-900/10",
  info:     "hover:bg-yellow-50/60 dark:hover:bg-yellow-900/10",
};

// ── Component ──────────────────────────────────────────────────────────────────

export function WCAlertBanner() {
  const [expanded, setExpanded] = useState(true);
  const { user } = useAuth();
  const watch     = user?.watch_unit ?? "";
  // The crewing board that matters now (from the watch's rota): the shift
  // running, or the next one today — e.g. tonight's night in the afternoon.
  const crewShift = crewingShiftFor(watch);
  const shiftDate = crewShift?.shiftDate ?? "";
  const shiftType = crewShift?.shiftType;

  // Re-use same queryKeys as the individual widgets → React Query returns cached
  // data instantly; no extra network requests are made.
  // Back to work interviews still to do for this WC/CC's watch.
  const { data: btwData } = useQuery({
    queryKey: ["back-to-work", "due"],
    queryFn: () => backend.absence.listBackToWork({}),
    staleTime: 60_000,
  });
  // Hydrant faults found on this watch's route and not yet emailed away.
  const hydrantYear = new Date().getFullYear();
  const { data: hydrantData } = useQuery({
    queryKey: ["hydrants", "route", watch, hydrantYear],
    queryFn: () => backend.hydrants.getHydrantRoute({ watch: watch || undefined, year: hydrantYear }),
    enabled: !!watch,
    staleTime: 5 * 60_000,
  });
  const { data: missedData } = useQuery({
    queryKey: ["missed-checks"],
    queryFn: () => backend.task.missedChecks({ days: 7 }),
    staleTime: 5 * 60_000,
  });
  const { data: inspectionsData } = useQuery({
    queryKey: ["wc-inspections"],
    queryFn: () => backend.inspection.list({ limit: 200 }),
  });

  // Names for alerts about people (same cache as the Tasks page).
  const { data: peopleData } = useQuery({
    queryKey: ["people-for-tasks"],
    queryFn: async () => (await backend.profile.listWithUsers({ limit: 500 })).people ?? [],
    staleTime: 5 * 60 * 1000,
  });
  const nameOf = (id: string) => {
    const p = (peopleData ?? []).find((x) => x.user.id === id);
    return p?.user.name || p?.user.email?.split("@")[0] || "Unknown";
  };

  const { data: profilesData } = useQuery({
    queryKey: ["wc-sickness-triggers"],
    queryFn: () => backend.profile.list({ limit: 200 }),
  });

  const { data: crewStats } = useQuery({
    queryKey: ["wc-crew-stats"],
    queryFn: () => backend.crew.getStats(),
  });

  const { data: skillsData } = useQuery({
    queryKey: ["wc-skills-expiring"],
    queryFn: () => backend.skill.listExpiring(),
    refetchInterval: 5 * 60 * 1000,
  });

  // Who is off sick on that shift's date (station-wide, so a Head for Head
  // from another watch counts too)?
  const { data: sickOn } = useSickOn(shiftDate, !!crewShift);

  // That shift's crewing for this watch (same key as WCShiftWidget → cache hit)
  const { data: crewingData } = useQuery({
    queryKey: ["wc-shift-crewing", watch, shiftDate, shiftType],
    queryFn: () => backend.crewing.list({ watch, shift_date: shiftDate, shift_type: shiftType! }),
    enabled: !!watch && !!crewShift,
  });

  // ── Derive alert items ─────────────────────────────────────────────────────

  const alerts: AlertItem[] = [];
  const now = startOfDay(new Date());

  // CRITICAL: Overdue inspections
  const overdueCount = (inspectionsData?.inspections ?? []).filter((i) => {
    if (i.status === "Complete") return false;
    if (!i.scheduled_for) return false;
    return isBefore(parseISO(i.scheduled_for), now);
  }).length;
  if (overdueCount > 0) {
    alerts.push({
      id:    "overdue-inspections",
      severity: "critical",
      Icon:  CalendarCheck,
      label: overdueCount === 1 ? "Overdue inspection" : "Overdue inspections",
      count: overdueCount,
      href:  "/calendar",
    });
  }

  // CRITICAL: Expired certifications
  const expiredSkills = skillsData?.expired_count ?? 0;
  if (expiredSkills > 0) {
    alerts.push({
      id:    "expired-skills",
      severity: "critical",
      Icon:  XCircle,
      label: expiredSkills === 1 ? "Expired certification" : "Expired certifications",
      count: expiredSkills,
      href:  "/people",
    });
  }

  // Absence triggers: the app only flags that someone has reached them —
  // the stage is a note the Station Commander puts on their attendance
  // file. Names link to the profile (one person: straight there).
  const profiles = profilesData?.profiles ?? [];
  const triggered = profiles
    .filter((p) => p.trigger_stage && p.trigger_stage !== "None")
    .map((p) => ({ id: p.user_id, name: nameOf(p.user_id) }));
  if (triggered.length > 0) {
    alerts.push({
      id:    "absence-triggers",
      severity: "warning",
      Icon:  ShieldAlert,
      label: "Absence triggers hit",
      count: triggered.length,
      href:  triggered.length === 1 ? `/people/${triggered[0].id}` : "/people",
      people: triggered,
    });
  }

  // CRITICAL: Sick staff assigned to today's crewing slots → gap alert
  const sickUserIds  = sickOn?.ids ?? new Set<string>();
  const crewEntries  = crewingData?.entries ?? [];
  const sickOnCrew   = crewEntries.filter((e) => e.user_id && sickUserIds.has(e.user_id));

  if (sickOnCrew.length > 0) {
    // Build a short label: first person's name + role, then "and N others" if multiple
    const roleLabel = (role: string) =>
      role === "oic" ? "OIC" : role === "driver" ? "Driver" : role === "ba" ? "BA" : role === "baeco" ? "BA ECO" : role.toUpperCase();
    const applianceLabel = (a: string) =>
      a === "b10p1" ? "B10P1" : a === "b10p2" ? "B10P2" : a;

    const first = sickOnCrew[0];
    const firstName = first.user_name ?? "Unknown";
    const firstSlot = `${roleLabel(first.crew_role)}, ${applianceLabel(first.appliance)}`;
    const rest = sickOnCrew.length - 1;

    const label = rest === 0
      ? `crew gap — ${firstName} (${firstSlot}) is off sick`
      : `crew gaps — ${firstName} (${firstSlot}) and ${rest} other${rest > 1 ? "s" : ""} off sick`;

    alerts.push({
      id:       "sick-crew-gap",
      severity: "critical",
      Icon:     UserX,
      label,
      count:    sickOnCrew.length,
      href:     "/handover",
    });
  }

  // WARNING: Back to work interviews due (first shift back after sickness)
  const btw = btwData?.interviews ?? [];
  if (btw.length > 0) {
    alerts.push({
      id:    "back-to-work",
      severity: "warning",
      Icon:  MessageSquare,
      label: btw.length === 1 ? "Back to work interview due" : "Back to work interviews due",
      count: btw.length,
      href:  btw.length === 1 ? `/people/${btw[0].user_id}` : "/people",
      people: btw.map((i) => ({ id: i.user_id, name: `${i.name ?? "Unknown"} (${i.shift_label})` })),
    });
  }

  // WARNING: Station checks missed in the last 7 days — on this watch's shifts,
  // plus weekly-and-longer ones (the station's, whoever was on).
  const missedMine = (missedData?.checks ?? []).filter(
    (c) => c.watches.length === 0 || c.watches.some((w) => w.toLowerCase() === watch.toLowerCase())
  ).length;
  if (missedMine > 0) {
    alerts.push({
      id:    "missed-checks",
      severity: "warning",
      Icon:  ClipboardCheck,
      label: missedMine === 1 ? "Station check missed (7 days)" : "Station checks missed (7 days)",
      count: missedMine,
      href:  "/tasks",
    });
  }

  // WARNING: Hydrant faults not yet sent in a fault report
  const hydrantFaults = hydrantData?.to_report ?? 0;
  if (hydrantFaults > 0) {
    alerts.push({
      id:    "hydrant-faults",
      severity: "warning",
      Icon:  Flame,
      label: hydrantFaults === 1 ? "Hydrant fault to report" : "Hydrant faults to report",
      count: hydrantFaults,
      href:  "/hydrants",
    });
  }

  // WARNING: Overdue tasks
  const overdueTasks = crewStats?.overdue_tasks ?? 0;
  if (overdueTasks > 0) {
    alerts.push({
      id:    "overdue-tasks",
      severity: "warning",
      Icon:  ClipboardCheck,
      label: overdueTasks === 1 ? "Overdue task" : "Overdue tasks",
      count: overdueTasks,
      href:  "/tasks",
    });
  }



  // WARNING: Certifications expiring soon
  const expiringSoon = skillsData?.warning_count ?? 0;
  if (expiringSoon > 0) {
    alerts.push({
      id:    "expiring-skills",
      severity: "warning",
      Icon:  AlertTriangle,
      label: expiringSoon === 1 ? "Certification expiring soon" : "Certifications expiring soon",
      count: expiringSoon,
      href:  "/people",
    });
  }



  // Nothing to surface — say so, so a WC/CC knows the list is live and empty
  // rather than wondering whether it loaded.
  // Only say "all caught up" once everything has loaded — never on a blank
  // first render.
  const loaded = [btwData, missedData, inspectionsData, profilesData, crewStats, skillsData].every((d) => d !== undefined);
  if (alerts.length === 0) {
    if (!loaded) return null;
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 text-sm animate-in fade-in-0 duration-300">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="font-medium text-foreground">All caught up</span>
        <span className="text-muted-foreground">— nothing needs you right now.</span>
      </div>
    );
  }

  // Most urgent first.
  const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);

  const criticalItems = alerts.filter((a) => a.severity === "critical").length;
  const warningItems  = alerts.filter((a) => a.severity === "warning").length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section
      aria-label="Needs you"
      className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-sm animate-in fade-in-0 slide-in-from-top-2 duration-300"
    >
      {/* Summary / toggle header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse alert panel" : "Expand alert panel"}
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-sm font-semibold text-foreground">Needs you</span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{alerts.length}</span>
          {criticalItems > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 motion-safe:animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
              </span>
              {criticalItems} critical
            </span>
          )}
          {warningItems > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
              {warningItems} warning
            </span>
          )}
        </div>
        {expanded
          ? <ChevronUp   className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        }
      </button>

      {/* Alert rows — a severity rail on the left, one sentence, one action */}
      {expanded && (
        <ul className="divide-y divide-border/60 border-t border-border/60">
          {alerts.map((alert) => {
            const Icon = alert.Icon;
            const action = alert.people?.length === 1 ? "See profile" : alert.people?.length ? "See all" : "Open";
            return (
              <li key={alert.id} className={cn("relative flex items-center gap-3 pl-5 pr-3 py-3 transition-colors group", rowHover[alert.severity])}>
                <span className={cn("absolute left-0 inset-y-0 w-[3px]", rail[alert.severity])} aria-hidden="true" />
                <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", tile[alert.severity])}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0 text-sm text-foreground">
                  <span className={cn("font-semibold tabular-nums mr-1.5", countText[alert.severity])}>{alert.count}</span>
                  {alert.label}
                  {alert.people?.length ? (
                    <>
                      {" — "}
                      {alert.people.map((p, i) => (
                        <span key={p.id}>
                          {i > 0 && ", "}
                          <Link to={`/people/${p.id}`} className="font-medium underline-offset-2 hover:underline hover:text-primary">
                            {p.name}
                          </Link>
                        </span>
                      ))}
                    </>
                  ) : null}
                </span>
                <Link
                  to={alert.href}
                  className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border/80 bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-foreground/30 hover:bg-muted"
                >
                  <span className="hidden sm:inline">{action}</span>
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
