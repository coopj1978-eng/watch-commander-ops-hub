import { useQuery } from "@tanstack/react-query";
import backend from "@/lib/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Target } from "lucide-react";
import { startOfMonth, endOfMonth, format } from "date-fns";

export function WCTargetsWidget() {
  const now = new Date();
  const periodStart = format(startOfMonth(now), "yyyy-MM-dd");
  const periodEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["wc-targets", periodStart, periodEnd],
    queryFn: async () =>
      backend.targets.list({ period_start: periodStart, period_end: periodEnd, limit: 100 }),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-32" />
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

  const targets = data?.targets ?? [];

  if (targets.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Targets Progress</CardTitle>
          <Target className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No targets set for this month</p>
        </CardContent>
      </Card>
    );
  }

  const totalTarget = targets.reduce((sum, t) => sum + t.target_count, 0);
  const totalActual = targets.reduce((sum, t) => sum + t.actual_count, 0);
  const overallPct = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

  const atRisk = targets.filter((t) => t.status === "at_risk").length;
  const overdue = targets.filter((t) => t.status === "overdue").length;
  const completed = targets.filter((t) => t.status === "completed").length;

  const progressColor =
    overallPct >= 75 ? "text-green-500" : overallPct >= 40 ? "text-yellow-500" : "text-red-500";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Targets Progress</CardTitle>
        <Target className="h-4 w-4 text-green-500" />
      </CardHeader>
      <CardContent>
        <div className={`text-4xl font-bold ${progressColor}`}>{overallPct}%</div>
        <p className="text-xs text-muted-foreground mt-1">
          {totalActual} / {totalTarget} this month
        </p>
        <Progress value={overallPct} className="mt-3 h-1.5" />
        <div className="flex gap-3 mt-2 text-xs">
          <span className="text-muted-foreground">{completed} done</span>
          {atRisk > 0 && <span className="text-yellow-500 font-medium">{atRisk} at risk</span>}
          {overdue > 0 && <span className="text-red-500 font-medium">{overdue} overdue</span>}
        </div>
      </CardContent>
    </Card>
  );
}
