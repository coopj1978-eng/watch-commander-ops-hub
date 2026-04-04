import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import backend from "@/lib/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  ClipboardCheck,
  CalendarCheck,
  Calendar,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";

function CCStatsSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-8 w-12" />
        <Skeleton className="h-3 w-36" />
      </CardContent>
    </Card>
  );
}

export function CCCrewWidget() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["cc-crew-stats"],
    queryFn: async () => backend.crew.getStats(),
  });

  if (isLoading) return <CCStatsSkeleton className="border-t-2 border-t-indigo-500" />;
  if (!stats) return null;

  return (
    <Card className="border-t-2 border-t-indigo-500">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">My Crew</CardTitle>
        <Users className="h-4 w-4 text-indigo-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{stats.total_firefighters}</div>
        <p className="text-xs text-muted-foreground mt-1">Assigned crew members</p>
      </CardContent>
    </Card>
  );
}

export function CCTasksWidget() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["cc-crew-stats"],
    queryFn: async () => backend.crew.getStats(),
  });

  if (isLoading) return <CCStatsSkeleton className="border-t-2 border-t-indigo-500" />;
  if (!stats) return null;

  const { total_tasks, completed_tasks, overdue_tasks, completion_rate } = stats;
  const accentColor = overdue_tasks > 0 ? "border-t-amber-500" : "border-t-indigo-500";

  return (
    <Card className={`border-t-2 ${accentColor}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Crew Tasks</CardTitle>
        <ClipboardCheck className="h-4 w-4 text-blue-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{total_tasks}</div>
        <p className="text-xs text-muted-foreground mt-1">Total tasks</p>
        <Progress value={completion_rate} className="mt-3 h-1.5" />
        <div className="flex justify-between mt-2 text-xs">
          <span className="text-muted-foreground">{completion_rate}% complete</span>
          {overdue_tasks > 0 && (
            <span className="text-red-500 font-medium">{overdue_tasks} overdue</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function CCInspectionsWidget() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["cc-crew-stats"],
    queryFn: async () => backend.crew.getStats(),
  });

  if (isLoading) return <CCStatsSkeleton className="border-t-2 border-t-purple-500" />;
  if (!stats) return null;

  return (
    <Card className="border-t-2 border-t-purple-500">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Upcoming Inspections</CardTitle>
        <CalendarCheck className="h-4 w-4 text-purple-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{stats.upcoming_inspections}</div>
        <p className="text-xs text-muted-foreground mt-1">Due in next 14 days</p>
      </CardContent>
    </Card>
  );
}

export function CCOneToOnesWidget() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["cc-crew-stats"],
    queryFn: async () => backend.crew.getStats(),
  });

  if (isLoading) return <CCStatsSkeleton className="border-t-2 border-t-indigo-500" />;
  if (!stats) return null;

  const overdue = stats.overdue_one_to_ones;
  const accentColor = overdue > 0 ? "border-t-amber-500" : "border-t-indigo-500";

  return (
    <Card className={`border-t-2 ${accentColor}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Overdue 1:1s</CardTitle>
        <Calendar className={`h-4 w-4 ${overdue > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${overdue > 0 ? "text-orange-500" : ""}`}>
          {overdue}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {overdue === 0 ? "All 1:1s up to date" : "Welfare conversations needed"}
        </p>
      </CardContent>
    </Card>
  );
}

export function CCSicknessWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["cc-sickness-triggers"],
    queryFn: async () => backend.profile.list({ limit: 200 }),
  });

  if (isLoading) return <CCStatsSkeleton className="border-t-2 border-t-indigo-500" />;

  const profiles = data?.profiles ?? [];
  const stage1 = profiles.filter((p) => p.trigger_stage === "Stage1").length;
  const stage2 = profiles.filter((p) => p.trigger_stage === "Stage2").length;
  const stage3 = profiles.filter((p) => p.trigger_stage === "Stage3").length;
  const totalAlerts = stage1 + stage2 + stage3;

  const borderColor =
    stage3 > 0 ? "border-t-red-500" :
    stage2 > 0 ? "border-t-orange-500" :
    stage1 > 0 ? "border-t-amber-500" :
    "border-t-green-500";

  const alertColor =
    stage3 > 0
      ? "text-red-500"
      : stage2 > 0
      ? "text-orange-500"
      : stage1 > 0
      ? "text-yellow-500"
      : "";

  return (
    <Card className={`border-t-2 ${borderColor}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Sickness Triggers</CardTitle>
        <ShieldAlert className={`h-4 w-4 ${totalAlerts > 0 ? "text-red-500" : "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${alertColor}`}>{totalAlerts}</div>
        <p className="text-xs text-muted-foreground mt-1">
          {totalAlerts === 0 ? "No active triggers" : "Crew members at trigger stage"}
        </p>
        {totalAlerts > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {stage1 > 0 && (
              <Badge variant="outline" className="text-yellow-600 border-yellow-400 text-xs">
                Stage 1: {stage1}
              </Badge>
            )}
            {stage2 > 0 && (
              <Badge variant="outline" className="text-orange-600 border-orange-400 text-xs">
                Stage 2: {stage2}
              </Badge>
            )}
            {stage3 > 0 && (
              <Badge variant="outline" className="text-red-600 border-red-400 text-xs">
                Stage 3: {stage3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CCDashboard() {
  const navigate = useNavigate();

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Crew Commander Dashboard</h1>
          <p className="text-muted-foreground mt-1">Your crew at a glance</p>
        </div>
        <Button onClick={() => navigate("/crew-home")} variant="outline">
          Full Crew Home
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <CCCrewWidget />
        <CCTasksWidget />
        <CCInspectionsWidget />
        <CCOneToOnesWidget />
        <CCSicknessWidget />
      </div>
    </div>
  );
}
