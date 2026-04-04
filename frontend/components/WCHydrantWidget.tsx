import { useQuery } from "@tanstack/react-query";
import backend from "@/lib/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Flame } from "lucide-react";
import { useAuth } from "@/App";
import { getCurrentFinancialPeriod } from "@/lib/financialQuarter";

export function WCHydrantWidget() {
  const { user } = useAuth();
  const watch     = user?.watch_unit ?? "";
  const { financial_year, quarter, label } = getCurrentFinancialPeriod();

  const { data, isLoading } = useQuery({
    queryKey: ["wc-hydrant", watch, financial_year, quarter],
    queryFn:  () =>
      backend.activity.list({
        type: "hydrant",
        watch: watch || undefined,
        financial_year,
        quarter,
      }),
    enabled: !!watch,
  });

  if (isLoading) {
    return (
      <Card>
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Hydrant Inspections</CardTitle>
          <Flame className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No watch assigned</p>
        </CardContent>
      </Card>
    );
  }

  const items     = data?.items ?? [];
  const total     = items.length;
  const completed = items.filter(i => i.completed).length;
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

  const pctColor =
    pct >= 100 ? "text-green-500" :
    pct >= 75  ? "text-blue-500"  :
    pct >= 50  ? "text-yellow-500" :
                 "text-red-500";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Hydrant Inspections</CardTitle>
        <Flame className="h-4 w-4 text-orange-500" />
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <>
            <div className="text-4xl font-bold text-muted-foreground">0</div>
            <p className="text-xs text-muted-foreground mt-1">
              No inspections added — {label}
            </p>
            <p className="text-xs text-amber-500 mt-2">
              Add inspections via Performance Targets.
            </p>
          </>
        ) : (
          <>
            <div className={`text-4xl font-bold ${pctColor}`}>
              {completed}{" "}
              <span className="text-base font-normal text-muted-foreground">/ {total}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {pct}% complete — {label}
            </p>
            <Progress value={Math.min(pct, 100)} className="mt-3 h-1.5" />
            <p className="text-xs text-muted-foreground mt-2">
              {total - completed} remaining this quarter
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
