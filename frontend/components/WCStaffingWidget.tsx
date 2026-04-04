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

  const { data: profilesData, isLoading: profilesLoading } = useQuery({
    queryKey: ["wc-profiles", watch],
    queryFn: async () => backend.profile.list({ watch: watch || undefined, limit: 200 }),
    enabled: true,
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

  const isLoading = profilesLoading || absencesLoading;

  const animatedTotal = useCountUp(profilesData?.total ?? 0);

  if (isLoading) {
    return (
      <Card className="border-t-2 border-t-indigo-500">
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

  const total = profilesData?.total ?? 0;
  const absences = absencesData?.absences ?? [];

  // Only count absences for people on this watch
  const watchUserIds = new Set((profilesData?.profiles ?? []).map((p) => p.user_id));
  const watchAbsences = watch
    ? absences.filter((a) => watchUserIds.has(a.firefighter_id))
    : absences;

  const sickToday = watchAbsences.filter((a) => a.type === "sickness").length;
  const onLeaveToday = watchAbsences.filter((a) => a.type !== "sickness").length;
  const onDuty = Math.max(0, total - sickToday - onLeaveToday);

  return (
    <Card className="border-t-2 border-t-indigo-500">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Staffing Today</CardTitle>
        <Users className="h-4 w-4 text-indigo-500" />
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
