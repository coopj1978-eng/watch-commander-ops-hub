import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import backend from "@/lib/backend";
import { useAuth } from "@/App";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CalendarCheck,
  ClipboardCheck,
  ShieldAlert,
  UserX,
  XCircle,
} from "lucide-react";
import { isBefore, parseISO, startOfDay } from "date-fns";
import { getTodayShift, hasRotaConfig } from "@/lib/shiftRota";

type CrewingShiftType = "1st Day" | "2nd Day" | "1st Night" | "2nd Night";

/**
 * Returns the current shift type using the rota for 1st/2nd designation.
 * Clock determines day (08:00–18:00) vs night; rota determines 1st vs 2nd.
 * Falls back to "2nd Day" / "2nd Night" when no rota config is available.
 */
function getShiftTypeForWatch(watchName: string): CrewingShiftType {
  const h = new Date().getHours();
  const isDay = h >= 8 && h < 18;

  if (watchName && hasRotaConfig(watchName)) {
    const todayShift = getTodayShift(watchName);
    if (todayShift?.isWorking) {
      return todayShift.shiftType as CrewingShiftType;
    }
  }

  // Fallback: no rota / rest / leave — default to "2nd" (main running shift)
  return isDay ? "2nd Day" : "2nd Night";
}

// ── Types ──────────────────────────────────────────────────────────────────────

type Severity = "critical" | "warning" | "info";

interface AlertItem {
  id: string;
  severity: Severity;
  Icon: React.ElementType;
  label: string;
  count: number;
  href: string;
}

// ── Severity styling ───────────────────────────────────────────────────────────

const dot: Record<Severity, string> = {
  critical: "bg-red-500",
  warning:  "bg-amber-500",
  info:     "bg-yellow-400",
};

const countText: Record<Severity, string> = {
  critical: "text-red-600 dark:text-red-400",
  warning:  "text-amber-600 dark:text-amber-400",
  info:     "text-yellow-600 dark:text-yellow-400",
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
  const today     = new Date().toISOString().split("T")[0];
  const shiftType = getShiftTypeForWatch(watch);

  // Re-use same queryKeys as the individual widgets → React Query returns cached
  // data instantly; no extra network requests are made.
  const { data: inspectionsData } = useQuery({
    queryKey: ["wc-inspections"],
    queryFn: () => backend.inspection.list({ limit: 200 }),
  });

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

  // Who is off sick today?
  const { data: sickData } = useQuery({
    queryKey: ["absences-today-sick"],
    queryFn: () => backend.absence.todaySick(),
    refetchInterval: 5 * 60 * 1000,
  });

  // Today's crewing for this watch (same key as WCShiftWidget → cache hit)
  const { data: crewingData } = useQuery({
    queryKey: ["wc-shift-crewing", watch, today, shiftType],
    queryFn: () => backend.crewing.list({ watch, shift_date: today, shift_type: shiftType }),
    enabled: !!watch,
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

  // CRITICAL: Stage 3 sickness triggers
  const profiles = profilesData?.profiles ?? [];
  const stage3 = profiles.filter((p) => p.trigger_stage === "Stage3").length;
  if (stage3 > 0) {
    alerts.push({
      id:    "sickness-stage3",
      severity: "critical",
      Icon:  ShieldAlert,
      label: stage3 === 1 ? "Stage 3 sickness trigger" : "Stage 3 sickness triggers",
      count: stage3,
      href:  "/people",
    });
  }

  // CRITICAL: Sick staff assigned to today's crewing slots → gap alert
  const sickUserIds  = new Set((sickData?.sick_staff ?? []).map((s) => s.user_id));
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

  // WARNING: Stage 2 sickness triggers
  const stage2 = profiles.filter((p) => p.trigger_stage === "Stage2").length;
  if (stage2 > 0) {
    alerts.push({
      id:    "sickness-stage2",
      severity: "warning",
      Icon:  ShieldAlert,
      label: stage2 === 1 ? "Stage 2 sickness trigger" : "Stage 2 sickness triggers",
      count: stage2,
      href:  "/people",
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

  // INFO: Stage 1 sickness triggers
  const stage1 = profiles.filter((p) => p.trigger_stage === "Stage1").length;
  if (stage1 > 0) {
    alerts.push({
      id:    "sickness-stage1",
      severity: "info",
      Icon:  ShieldAlert,
      label: stage1 === 1 ? "Stage 1 sickness trigger" : "Stage 1 sickness triggers",
      count: stage1,
      href:  "/people",
    });
  }

  // Nothing to surface
  if (alerts.length === 0) return null;

  // ── Banner chrome colours (driven by highest severity) ─────────────────────

  const hasCritical = alerts.some((a) => a.severity === "critical");
  const hasWarning  = !hasCritical && alerts.some((a) => a.severity === "warning");

  const bannerBorder = hasCritical
    ? "border-red-300 dark:border-red-700"
    : hasWarning
    ? "border-amber-300 dark:border-amber-700"
    : "border-yellow-300 dark:border-yellow-700";

  const headerBg = hasCritical
    ? "bg-red-50 dark:bg-red-950/40"
    : hasWarning
    ? "bg-amber-50 dark:bg-amber-950/40"
    : "bg-yellow-50 dark:bg-yellow-950/40";

  const headerTextColor = hasCritical
    ? "text-red-700 dark:text-red-400"
    : hasWarning
    ? "text-amber-700 dark:text-amber-400"
    : "text-yellow-700 dark:text-yellow-400";

  const headerIcon = hasCritical
    ? "text-red-500"
    : hasWarning
    ? "text-amber-500"
    : "text-yellow-500";

  const criticalItems = alerts.filter((a) => a.severity === "critical").length;
  const warningItems  = alerts.filter((a) => a.severity === "warning").length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden shadow-sm",
        "animate-in fade-in-0 slide-in-from-top-2 duration-300",
        bannerBorder,
      )}
    >
      {/* Summary / toggle header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "w-full flex items-center justify-between gap-3 px-4 py-2.5",
          "text-left transition-colors cursor-pointer",
          headerBg,
        )}
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse alert panel" : "Expand alert panel"}
      >
        <div className={cn("flex items-center gap-2 flex-wrap", headerTextColor)}>
          <AlertTriangle className={cn("h-4 w-4 shrink-0", headerIcon)} aria-hidden="true" />
          <span className="text-sm font-semibold">
            {alerts.length} item{alerts.length !== 1 ? "s" : ""} need{alerts.length === 1 ? "s" : ""} attention
          </span>
          <span className="h-3.5 w-px bg-current opacity-30 hidden sm:block" />
          <div className="flex gap-1.5">
            {criticalItems > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" aria-hidden="true" />
                {criticalItems} critical
              </span>
            )}
            {warningItems > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
                {warningItems} warning
              </span>
            )}
          </div>
        </div>
        {expanded
          ? <ChevronUp   className={cn("h-4 w-4 shrink-0", headerTextColor)} aria-hidden="true" />
          : <ChevronDown className={cn("h-4 w-4 shrink-0", headerTextColor)} aria-hidden="true" />
        }
      </button>

      {/* Alert rows */}
      {expanded && (
        <div className="divide-y divide-border/50">
          {alerts.map((alert) => {
            const Icon = alert.Icon;
            return (
              <Link
                key={alert.id}
                to={alert.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5",
                  "bg-background transition-colors group",
                  rowHover[alert.severity],
                )}
              >
                <span
                  className={cn("w-2 h-2 rounded-full shrink-0", dot[alert.severity])}
                  aria-hidden="true"
                />
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1 text-sm text-foreground">
                  <span className={cn("font-bold tabular-nums mr-1.5", countText[alert.severity])}>
                    {alert.count}
                  </span>
                  {alert.label}
                </span>
                <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-0.5 shrink-0">
                  View →
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
