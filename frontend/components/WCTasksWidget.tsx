import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import backend from "@/lib/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MiniRing } from "@/components/ui/MiniRing";
import { ClipboardCheck, ChevronRight } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";

export function WCTasksWidget() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["wc-crew-stats"],
    queryFn: async () => backend.crew.getStats(),
  });

  const animatedTotal = useCountUp(stats?.total_tasks ?? 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-3 w-36" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const { total_tasks, completed_tasks, overdue_tasks, completion_rate } = stats;
  const activeTasks = total_tasks - completed_tasks;

  const accentColor = overdue_tasks > 0 ? "border-t-amber-500" : "border-t-blue-500";

  return (
    <Card className={`border-t-2 ${accentColor}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Tasks Overview</CardTitle>
        <ClipboardCheck className="h-4 w-4 text-blue-500" />
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-4xl font-bold tabular-nums">{animatedTotal}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Total tasks</p>
          </div>
          <MiniRing value={completion_rate} className="text-blue-500" />
        </div>
        <div className="flex justify-between mt-2 text-xs">
          <span className="text-muted-foreground">{completion_rate}% complete</span>
          {overdue_tasks > 0 && (
            <span className="text-red-500 font-medium">{overdue_tasks} overdue</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {activeTasks} active · {completed_tasks} done
        </p>
        <Link
          to="/tasks"
          className="mt-3 flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary transition-colors group border-t border-border/40 pt-2"
        >
          View all tasks
          <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </CardContent>
    </Card>
  );
}
