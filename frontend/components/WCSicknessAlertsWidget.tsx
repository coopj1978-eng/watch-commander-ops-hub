import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import backend from "@/lib/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldAlert, ChevronRight } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { MiniBar } from "@/components/ui/MiniBar";

export function WCSicknessAlertsWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["wc-sickness-triggers"],
    queryFn: async () => backend.profile.list({ limit: 200 }),
  });

  // Compute before any early returns so hooks are always called in the same order
  const profiles    = data?.profiles ?? [];
  const stage1      = profiles.filter((p) => p.trigger_stage === "Stage1").length;
  const stage2      = profiles.filter((p) => p.trigger_stage === "Stage2").length;
  const stage3      = profiles.filter((p) => p.trigger_stage === "Stage3").length;
  const totalAlerts = stage1 + stage2 + stage3;
  const animatedAlerts = useCountUp(totalAlerts);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-3 w-40" />
        </CardContent>
      </Card>
    );
  }

  const alertColor =
    stage3 > 0 ? "text-red-500" : stage2 > 0 ? "text-orange-500" : stage1 > 0 ? "text-yellow-500" : "text-green-500";

  const accentColor =
    stage3 > 0 ? "border-t-red-500" :
    stage2 > 0 ? "border-t-orange-500" :
    stage1 > 0 ? "border-t-amber-500" :
                 "border-t-green-500";

  return (
    <Card className={`border-t-2 ${accentColor}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Sickness Triggers</CardTitle>
        <ShieldAlert className={`h-4 w-4 ${totalAlerts > 0 ? "text-red-500" : "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-4xl font-bold tabular-nums ${alertColor}`}>{animatedAlerts}</div>
        <p className="text-xs text-muted-foreground mt-1">
          {totalAlerts === 0 ? "No active triggers" : "Staff at trigger stage"}
        </p>
        <MiniBar
          segments={[
            { value: profiles.length - totalAlerts, className: "bg-green-500/60" },
            { value: stage1, className: "bg-yellow-500" },
            { value: stage2, className: "bg-orange-500" },
            { value: stage3, className: "bg-red-500" },
          ]}
          total={profiles.length}
          className="mt-3"
        />
        {totalAlerts > 0 && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {stage1 > 0 && (
              <Badge variant="outline" className="text-yellow-600 border-yellow-400 dark:text-yellow-400 dark:border-yellow-600 text-xs">
                Stage 1: {stage1}
              </Badge>
            )}
            {stage2 > 0 && (
              <Badge variant="outline" className="text-orange-600 border-orange-400 dark:text-orange-400 dark:border-orange-600 text-xs">
                Stage 2: {stage2}
              </Badge>
            )}
            {stage3 > 0 && (
              <Badge variant="outline" className="text-red-600 border-red-400 dark:text-red-400 dark:border-red-600 text-xs">
                Stage 3: {stage3}
              </Badge>
            )}
          </div>
        )}
        <Link
          to="/people"
          className="mt-3 flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary transition-colors group border-t border-border/40 pt-2"
        >
          View staff records
          <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </CardContent>
    </Card>
  );
}
