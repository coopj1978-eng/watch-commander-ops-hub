import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, ChevronRight, AlertCircle, Plus } from "lucide-react";
import { formatDistanceToNow, parseISO, format } from "date-fns";
import { useUserRole } from "@/lib/rbac";

export function WCHandoverWidget() {
  const { user } = useAuth();
  const role = useUserRole();
  const watch = user?.watch_unit ?? "";

  const { data, isLoading } = useQuery({
    queryKey: ["wc-latest-handover"],
    queryFn: async () => backend.handover.getLatest({ watch: watch || undefined }),
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className="border-t-2 border-t-indigo-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    );
  }

  const latest = data?.handover;
  const canWrite = role === "WC" || role === "CC";

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!latest) {
    return (
      <Card className="border-t-2 border-t-indigo-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Last Handover</CardTitle>
          <ClipboardList className="h-4 w-4 text-indigo-500" />
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="text-sm">No handover notes have been recorded yet</span>
          </div>
          {canWrite && (
            <Link to="/handover?tab=handover">
              <Button size="sm" variant="outline" className="shrink-0 gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Write first handover
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>
    );
  }

  const timeAgo = formatDistanceToNow(parseISO(latest.created_at), { addSuffix: true });
  const shiftDateStr = format(parseISO(latest.shift_date), "dd MMM yyyy");
  const hasIncidents = !!latest.incidents;
  const hasTasks = !!latest.outstanding_tasks;

  // Top accent: orange if there are incidents/outstanding tasks, otherwise indigo
  const accentBorder = hasIncidents || hasTasks
    ? "border-t-orange-500"
    : "border-t-indigo-500";

  return (
    <Card className={`border-t-2 ${accentBorder}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="text-sm font-medium">Last Handover</CardTitle>
          <Badge variant="outline" className="text-xs">
            {latest.watch} Watch · {latest.shift_type}
          </Badge>
          <span className="text-xs text-muted-foreground">{shiftDateStr}</span>
        </div>
        <ClipboardList className={`h-4 w-4 shrink-0 ${hasIncidents || hasTasks ? "text-orange-500" : "text-indigo-500"}`} />
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Author + time */}
        <p className="text-xs text-muted-foreground">
          Written by <span className="font-medium text-foreground">{latest.written_by_name ?? "Unknown"}</span> · {timeAgo}
        </p>

        {/* General notes preview */}
        {latest.general_notes && (
          <p className="text-sm text-foreground line-clamp-2 leading-relaxed">
            {latest.general_notes}
          </p>
        )}

        {/* Section pills */}
        {(hasIncidents || hasTasks || latest.equipment_notes || latest.staff_notes) && (
          <div className="flex flex-wrap gap-2 pt-0.5">
            {latest.incidents && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                Incidents noted
              </span>
            )}
            {latest.outstanding_tasks && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Outstanding tasks
              </span>
            )}
            {latest.equipment_notes && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                Equipment notes
              </span>
            )}
            {latest.staff_notes && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                Staff notes
              </span>
            )}
          </div>
        )}

        {/* Footer CTA */}
        <Link
          to="/handover?tab=handover"
          className="mt-1 flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary transition-colors group border-t border-border/40 pt-2"
        >
          View all handover notes
          <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </CardContent>
    </Card>
  );
}
