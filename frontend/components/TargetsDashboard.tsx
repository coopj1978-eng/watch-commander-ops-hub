import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import backend from "~backend/client";
import type { Target, TargetMetric } from "~backend/targets/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Target as TargetIcon, AlertCircle, CheckCircle2, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface TargetsDashboardProps {
  periodStart?: string;
  periodEnd?: string;
  showPeriodSelector?: boolean;
  onPeriodChange?: (start: string, end: string) => void;
}

export default function TargetsDashboard({ periodStart, periodEnd, showPeriodSelector = true, onPeriodChange }: TargetsDashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<"quarter" | "month">("quarter");

  const calculatePeriodDates = (period: "quarter" | "month"): { start: string; end: string } => {
    const now = new Date();
    let start: Date;
    let end: Date;

    if (period === "quarter") {
      const currentMonth = now.getMonth();
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
      start = new Date(now.getFullYear(), quarterStartMonth, 1);
      end = new Date(now.getFullYear(), quarterStartMonth + 3, 0);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    return {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    };
  };

  const handlePeriodChange = (period: "quarter" | "month") => {
    setSelectedPeriod(period);
    const dates = calculatePeriodDates(period);
    onPeriodChange?.(dates.start, dates.end);
  };

  const currentPeriodDates = useMemo(() => calculatePeriodDates(selectedPeriod), [selectedPeriod]);
  const activePeriodStart = periodStart || currentPeriodDates.start;
  const activePeriodEnd = periodEnd || currentPeriodDates.end;
  const { data: targetsData, isLoading } = useQuery({
    queryKey: ["targets", activePeriodStart, activePeriodEnd],
    queryFn: async () => {
      return await backend.targets.list({
        period_start: activePeriodStart,
        period_end: activePeriodEnd,
        limit: 100,
      });
    },
  });

  const targets = targetsData?.targets || [];

  const metricLabels: Record<TargetMetric, string> = {
    HFSV: "Home Fire Safety Visits",
    HighRise: "High Rise Inspections",
    Hydrants: "Hydrant Inspections",
    Activities: "Community Activities",
  };

  const metricIcons: Record<TargetMetric, React.ReactNode> = {
    HFSV: <TargetIcon className="h-5 w-5" />,
    HighRise: <TargetIcon className="h-5 w-5" />,
    Hydrants: <TargetIcon className="h-5 w-5" />,
    Activities: <TargetIcon className="h-5 w-5" />,
  };

  const metricsByType = useMemo(() => {
    const grouped: Record<string, Target[]> = {};
    targets.forEach((target) => {
      if (!grouped[target.metric]) {
        grouped[target.metric] = [];
      }
      grouped[target.metric].push(target);
    });
    return grouped;
  }, [targets]);

  const getAggregatedMetrics = (metric: TargetMetric) => {
    const metricTargets = metricsByType[metric] || [];
    const totalTarget = metricTargets.reduce((sum, t) => sum + t.target_count, 0);
    const totalActual = metricTargets.reduce((sum, t) => sum + t.actual_count, 0);
    const percentage = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
    
    return {
      totalTarget,
      totalActual,
      percentage,
      status: percentage >= 100 ? "completed" : percentage >= 80 ? "active" : percentage >= 50 ? "at_risk" : "overdue",
    };
  };

  const getStatusColor = (status: string) => {
    const colors = {
      completed: "bg-green-500/10 text-green-500",
      active: "bg-blue-500/10 text-blue-500",
      at_risk: "bg-yellow-500/10 text-yellow-500",
      overdue: "bg-red-500/10 text-red-500",
    };
    return colors[status as keyof typeof colors] || colors.active;
  };

  const getStatusIcon = (percentage: number) => {
    if (percentage >= 100) return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (percentage >= 80) return <TrendingUp className="h-5 w-5 text-blue-500" />;
    if (percentage >= 50) return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    return <TrendingDown className="h-5 w-5 text-red-500" />;
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return "bg-green-500";
    if (percentage >= 80) return "bg-blue-500";
    if (percentage >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const metrics: TargetMetric[] = ["HFSV", "HighRise", "Hydrants", "Activities"];

  const overallStats = useMemo(() => {
    const totalTarget = targets.reduce((sum, t) => sum + t.target_count, 0);
    const totalActual = targets.reduce((sum, t) => sum + t.actual_count, 0);
    const overallPercentage = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
    
    const completed = targets.filter(t => t.status === "completed").length;
    const atRisk = targets.filter(t => t.status === "at_risk").length;
    const overdue = targets.filter(t => t.status === "overdue").length;
    
    return {
      totalTarget,
      totalActual,
      overallPercentage,
      completed,
      atRisk,
      overdue,
      total: targets.length,
    };
  }, [targets]);

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  const formatPeriodLabel = () => {
    const start = new Date(activePeriodStart);
    const end = new Date(activePeriodEnd);
    if (selectedPeriod === "quarter") {
      const quarter = Math.floor(start.getMonth() / 3) + 1;
      return `Q${quarter} ${start.getFullYear()}`;
    }
    return start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  return (
    <div className="space-y-6">
      {showPeriodSelector && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold">Period: {formatPeriodLabel()}</h3>
              <p className="text-sm text-muted-foreground">
                {new Date(activePeriodStart).toLocaleDateString()} - {new Date(activePeriodEnd).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant={selectedPeriod === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => handlePeriodChange("month")}
              className={selectedPeriod === "month" ? "bg-red-600 hover:bg-red-700" : ""}
            >
              Month
            </Button>
            <Button
              variant={selectedPeriod === "quarter" ? "default" : "outline"}
              size="sm"
              onClick={() => handlePeriodChange("quarter")}
              className={selectedPeriod === "quarter" ? "bg-red-600 hover:bg-red-700" : ""}
            >
              Quarter
            </Button>
          </div>
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
            {getStatusIcon(overallStats.overallPercentage)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overallStats.totalActual} / {overallStats.totalTarget}
            </div>
            <Progress
              value={overallStats.overallPercentage}
              className="mt-3"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {overallStats.overallPercentage.toFixed(1)}% complete
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.completed}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {overallStats.total > 0 ? ((overallStats.completed / overallStats.total) * 100).toFixed(0) : 0}% of all targets
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">At Risk</CardTitle>
            <AlertCircle className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.atRisk}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Require attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <TrendingDown className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.overdue}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Behind schedule
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {metrics.map((metric) => {
          const stats = getAggregatedMetrics(metric);
          return (
            <Card key={metric}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {metricIcons[metric]}
                    <div>
                      <CardTitle className="text-base">{metricLabels[metric]}</CardTitle>
                      <CardDescription className="mt-1">
                        Target: {stats.totalTarget} | Actual: {stats.totalActual}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className={getStatusColor(stats.status)}>
                    {stats.status.replace("_", " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="relative">
                    <Progress
                      value={Math.min(stats.percentage, 100)}
                      className="h-3"
                    />
                    <div
                      className={`absolute top-0 left-0 h-3 rounded-full transition-all ${getProgressColor(stats.percentage)}`}
                      style={{ width: `${Math.min(stats.percentage, 100)}%` }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold">
                      {stats.percentage.toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Remaining</span>
                    <span className="font-medium">
                      {Math.max(0, stats.totalTarget - stats.totalActual)}
                    </span>
                  </div>

                  {stats.percentage >= 100 && (
                    <div className="flex items-center gap-2 text-sm text-green-500">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Target achieved!</span>
                    </div>
                  )}
                  
                  {stats.percentage < 50 && stats.totalTarget > 0 && (
                    <div className="flex items-center gap-2 text-sm text-red-500">
                      <AlertCircle className="h-4 w-4" />
                      <span>Action required</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {targets.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <TargetIcon className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground mt-4">No targets set for this period</p>
            <p className="text-sm text-muted-foreground mt-2">
              Create targets to track performance metrics
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
