import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import backend from "@/lib/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MiniRing } from "@/components/ui/MiniRing";
import { Building2, MapPin, ChevronRight } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { useAuth } from "@/App";

/**
 * WC Dashboard widget — shows how many multi-story inspections
 * the logged-in user's watch has completed for the current calendar year.
 */
export function WCMultiStoryWidget() {
  const { user } = useAuth();
  const watch = user?.watch_unit ?? "";
  const year  = new Date().getFullYear();

  const { data, isLoading } = useQuery({
    queryKey: ["wc-multistory", watch, year],
    queryFn: () =>
      backend.inspection_plans.listAssignments({
        plan_type: "multistory",
        watch:     watch || undefined,
        year:      year,
      }),
    enabled: !!watch,
  });

  const animatedCompleted = useCountUp(data?.totals?.complete ?? 0);

  if (isLoading) {
    return (
      <Card className="border-t-2 border-t-blue-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-3 w-28" />
        </CardContent>
      </Card>
    );
  }

  if (!watch) {
    return (
      <Card className="border-t-2 border-t-blue-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Multi-Story Inspections</CardTitle>
          <Building2 className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-1.5 py-3 text-center">
            <MapPin className="h-5 w-5 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">No watch unit assigned</p>
            <Link to="/settings" className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">
              Set up in Settings →
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const completed = data?.totals?.complete ?? 0;
  const total     = (data?.totals?.pending ?? 0) + completed;
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

  const accentColor = pct >= 100 ? "border-t-green-500" : pct >= 50 ? "border-t-blue-500" : "border-t-amber-500";

  const pctColor =
    pct >= 100 ? "text-green-500" :
    pct >= 75  ? "text-blue-500"  :
    pct >= 50  ? "text-yellow-500" :
                 "text-red-500";

  return (
    <Card className={`border-t-2 ${accentColor}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Multi-Story Inspections</CardTitle>
        <Building2 className="h-4 w-4 text-blue-500" />
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <>
            <div className="text-4xl font-bold text-muted-foreground">0</div>
            <p className="text-xs text-muted-foreground mt-1">
              No inspections assigned for {year}
            </p>
            <p className="text-xs text-amber-500 mt-2">
              Generate assignments in{" "}
              <Link to="/targets" className="underline hover:text-amber-600">Performance Targets</Link>.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className={`text-4xl font-bold tabular-nums ${pctColor}`}>
                  {animatedCompleted}{" "}
                  <span className="text-base font-normal text-muted-foreground">/ {total}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {pct}% complete — {year}
                </p>
              </div>
              <MiniRing value={Math.min(pct, 100)} className={pctColor} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {total - completed} remaining this year
            </p>
            <Link
              to="/targets"
              className="mt-3 flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary transition-colors group border-t border-border/40 pt-2"
            >
              Manage targets
              <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
