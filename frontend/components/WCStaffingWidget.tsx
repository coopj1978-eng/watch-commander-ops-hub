import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MiniBar } from "@/components/ui/MiniBar";
import { Users, ChevronRight } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";

export function WCStaffingWidget() {
  const { user } = useAuth();
  const watch = user?.watch_unit ?? "";

  // Count users on the watch (not profiles). A user that signed up normally
  // has a `users` row but may not have a `firefighter_profiles` row — the
  // old /profiles-based query silently dropped those, so Staffing Today read
  // "0 staff" for real watches. /crew/stats does the watch resolution from
  // users directly with the same COALESCE trick the roster endpoint uses.
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["wc-crew-stats"],
    queryFn: async () => backend.crew.getStats(),
  });

  const { data: absencesData, isLoading: absencesLoading } = useQuery({
    queryKey: ["wc-absences-today"],
    queryFn: async () =>
      backend.absence.list({
        status: "approved",
        start_date: new Date().toISOString().split("T")[0],
        end_date: new Date().toISOString().split("T")[0],
        limit: 200,
      }),
  });

  const isLoading = statsLoading || absencesLoading;

  const animatedTotal = useCountUp(statsData?.total_watch_members ?? 0);

  if (isLoading) {
    return (
      <Card className="border-t-2 border-t-brand">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-3 w-28" />
        </CardContent>
      </Card>
    );
  }

  const total = statsData?.total_watch_members ?? 0;
  const absences = absencesData?.absences ?? [];

  // Only count absences for people on this watch. Source-of-truth user IDs
  // now come from /crew/stats (users table) rather than /profiles, so
  // everyone on the watch is counted even if their profile row was never
  // created.
  const watchUserIds = new Set(statsData?.watch_member_ids ?? []);
  const watchAbsences = watch
    ? absences.filter((a) => watchUserIds.has(a.firefighter_id))
    : absences;

  const sickToday = watchAbsences.filter((a) => a.type === "sickness").length;
  const onLeaveToday = watchAbsences.filter((a) => a.type !== "sickness").length;
  const onDuty = Math.max(0, total - sickToday - onLeaveToday);

  return (
    <Card className="border-t-2 border-t-brand">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Staffing Today</CardTitle>
        <Users className="h-4 w-4 text-brand" />
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-bold tabular-nums">{animatedTotal}</div>
        <p className="text-xs text-muted-foreground mt-1">Total staff</p>
        <MiniBar
          segments={[
            { value: onDuty,       className: "bg-green-500" },
            { value: onLeaveToday, className: "bg-amber-500" },
            { value: sickToday,    className: "bg-red-500" },
          ]}
          total={total}
          className="mt-3"
        />
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {onDuty} on duty
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {onLeaveToday} on leave
          </span>
          {sickToday > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {sickToday} sick
            </span>
          )}
        </div>
        <Link
          to="/people"
          className="mt-3 flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary transition-colors group border-t border-border/40 pt-2"
        >
          View staff list
          <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </CardContent>
    </Card>
  );
}
