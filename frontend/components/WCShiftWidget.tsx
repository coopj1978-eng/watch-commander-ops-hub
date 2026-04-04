/**
 * WCShiftWidget — Today's crewing status card
 *
 * Shows B10P1 / B10P2 slot progress for the current shift.
 * "Manage Shift →" links to /handover (crewing tab).
 * Last handover is shown in the separate WCHandoverWidget.
 */

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { getTodayShift, hasRotaConfig } from "@/lib/shiftRota"; // used for isOnLeave/isOnRest badges
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck, Users, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

type CrewingShiftType = "1st Day" | "2nd Day" | "1st Night" | "2nd Night";

/**
 * Returns the current shift type using the rota for 1st/2nd designation.
 * Clock (08:00–18:00) determines day vs night; rota determines 1st vs 2nd.
 * Falls back to "2nd Day" / "2nd Night" when rota is unavailable.
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

  return isDay ? "2nd Day" : "2nd Night";
}

// Minimum crew targets per appliance
const MIN_CREW = { b10p1: 5, b10p2: 4 };

// ── Appliance slot mini-bar ───────────────────────────────────────────────────

function ApplianceBar({
  label,
  count,
  target,
}: {
  label: string;
  count: number;
  target: number;
}) {
  const pct = Math.min((count / target) * 100, 100);
  const full = count >= target;
  const critical = count === 0;

  const barColor = full ? "bg-green-500" : critical ? "bg-red-500" : "bg-amber-500";
  const textColor = full
    ? "text-green-600 dark:text-green-400"
    : critical
    ? "text-red-600 dark:text-red-400"
    : "text-amber-600 dark:text-amber-400";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <Truck className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium text-foreground">{label}</span>
        </div>
        <span className={`font-semibold tabular-nums ${textColor}`}>
          {count} / {target}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────

export function WCShiftWidget() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const watch = user?.watch_unit ?? "";

  const today     = new Date().toISOString().split("T")[0];
  const rotaShift = watch && hasRotaConfig(watch) ? getTodayShift(watch) : null;
  const isOnLeave = rotaShift?.isLeave ?? false;
  const isOnRest  = !isOnLeave && !(rotaShift?.isWorking ?? false);
  const shiftType = getShiftTypeForWatch(watch);

  const { data: crewingData, isLoading } = useQuery({
    queryKey: ["wc-shift-crewing", watch, today, shiftType],
    queryFn: () =>
      backend.crewing.list({ watch, shift_date: today, shift_type: shiftType }),
    enabled: !!watch,
    retry: false,
  });

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Card className="border-t-2 border-t-indigo-500">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-8 w-24" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
        </CardContent>
      </Card>
    );
  }

  // ── Derived data ────────────────────────────────────────────────────────
  const entries       = crewingData?.entries ?? [];
  const b10p1Count    = entries.filter(e => e.appliance === "b10p1").length;
  const b10p2Count    = entries.filter(e => e.appliance === "b10p2").length;
  const totalAssigned = entries.length;

  const crewingReady   = b10p1Count >= MIN_CREW.b10p1 && b10p2Count >= MIN_CREW.b10p2;
  const crewingStarted = totalAssigned > 0;

  return (
    <Card className="border-t-2 border-t-indigo-500">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-sm font-medium">Shift Management</CardTitle>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge
              variant="outline"
              className={`text-xs ${
                isOnLeave
                  ? "border-green-400 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20"
                  : isOnRest
                  ? "border-slate-300 text-muted-foreground"
                  : ""
              }`}
            >
              {isOnLeave ? "Annual Leave" : isOnRest ? "Rest Day" : `${shiftType} Shift`}
              {watch ? ` · ${watch} Watch` : ""}
            </Badge>
            {crewingReady ? (
              <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border-0">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Crewing set
              </Badge>
            ) : crewingStarted ? (
              <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-0">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Incomplete
              </Badge>
            ) : (
              <Badge className="text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-0">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Not set
              </Badge>
            )}
          </div>
        </div>
        <Button size="sm" onClick={() => navigate("/handover")}>
          {crewingStarted ? "Manage" : "Set Up"}
          <ArrowRight className="ml-1.5 h-3 w-3" />
        </Button>
      </CardHeader>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <CardContent className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          Today's Crewing
        </p>

        {!watch ? (
          <p className="text-sm text-muted-foreground italic">No watch assigned to your account</p>
        ) : isOnLeave ? (
          <div className="flex items-start gap-2 py-2 px-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <span className="text-lg mt-0.5">🌿</span>
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-300">{watch} Watch on Annual Leave</p>
              <p className="text-xs text-green-700/70 dark:text-green-400/70 mt-0.5">Plan ahead via Shift Management</p>
            </div>
          </div>
        ) : isOnRest ? (
          <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/40 border border-border/60">
            <span className="text-base">😴</span>
            <p className="text-sm text-muted-foreground">{watch} Watch rest day today</p>
          </div>
        ) : (
          <>
            <ApplianceBar label="B10P1 — 1st Pump" count={b10p1Count} target={MIN_CREW.b10p1} />
            <ApplianceBar label="B10P2 — 2nd Pump" count={b10p2Count} target={MIN_CREW.b10p2} />

            {!crewingStarted && (
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Crewing not yet set up for this shift
              </p>
            )}
            {crewingStarted && !crewingReady && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                {Math.max(0, MIN_CREW.b10p1 - b10p1Count) + Math.max(0, MIN_CREW.b10p2 - b10p2Count)} more crew needed
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
