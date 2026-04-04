import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import backend from "@/lib/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MiniBar } from "@/components/ui/MiniBar";
import { CalendarCheck, ChevronRight } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { addDays, isBefore, parseISO, isAfter, startOfDay } from "date-fns";

export function WCInspectionsWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["wc-inspections"],
    queryFn: async () => backend.inspection.list({ limit: 200 }),
  });

  // Derive all values before any early return so hooks are always called in the same order
  const inspections = data?.inspections ?? [];
  const now = startOfDay(new Date());
  const in14Days = addDays(now, 14);

  const upcoming = inspections.filter((i) => {
    if (i.status === "Complete") return false;
    if (!i.scheduled_for) return false;
    const date = parseISO(i.scheduled_for);
    return !isBefore(date, now) && !isAfter(date, in14Days);
  });

  const overdue = inspections.filter((i) => {
    if (i.status === "Complete") return false;
    if (!i.scheduled_for) return false;
    return isBefore(parseISO(i.scheduled_for), now);
  });

  const inProgress = inspections.filter((i) => i.status === "InProgress").length;
  const animatedUpcoming = useCountUp(upcoming.length);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-24" />
        </CardContent>
      </Card>
    );
  }

  const accentColor = overdue.length > 0 ? "border-t-red-500" : "border-t-purple-500";

  return (
    <Card className={`border-t-2 ${accentColor}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Inspections</CardTitle>
        <CalendarCheck className="h-4 w-4 text-purple-500" />
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-bold tabular-nums">{animatedUpcoming}</div>
        <p className="text-xs text-muted-foreground mt-1">Due in next 14 days</p>
        <MiniBar
          segments={[
            { value: upcoming.length, className: "bg-purple-500" },
            { value: inProgress,      className: "bg-blue-500" },
            { value: overdue.length,  className: "bg-red-500" },
          ]}
          total={upcoming.length + inProgress + overdue.length}
          className="mt-3"
        />
        <div className="flex gap-3 mt-2 text-xs">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-foreground font-medium">{inProgress}</span>
            <span className="text-muted-foreground">in progress</span>
          </span>
          {overdue.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
              <span className="text-red-500 font-medium">{overdue.length}</span>
              <span className="text-muted-foreground">overdue</span>
            </span>
          )}
        </div>
        <Link
          to="/calendar"
          className="mt-3 flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary transition-colors group border-t border-border/40 pt-2"
        >
          View all inspections
          <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </CardContent>
    </Card>
  );
}
