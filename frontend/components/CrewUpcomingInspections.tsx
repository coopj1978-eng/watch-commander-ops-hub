import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardCheck, MapPin, Calendar, AlertCircle } from "lucide-react";
import { format } from "date-fns";

export function CrewUpcomingInspections() {
  const { user: currentUser } = useAuth();

  const { data: user } = useQuery({
    queryKey: ["current-user", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return null;
      return await backend.user.get(currentUser.id);
    },
    enabled: !!currentUser?.id,
  });

  const { data: crewMembers } = useQuery({
    queryKey: ["crew-members", user?.watch_unit],
    queryFn: async () => {
      if (!user?.watch_unit) return [];
      const response = await backend.user.list({});
      return response.users.filter(
        (u) => u.role === "FF" && u.watch_unit === user.watch_unit
      );
    },
    enabled: !!user?.watch_unit,
  });

  const { data: inspections, isLoading } = useQuery({
    queryKey: ["crew-inspections", crewMembers],
    queryFn: async () => {
      const response = await backend.inspection.list({});
      const crewIds = crewMembers?.map((m) => m.id) || [];
      
      return response.inspections
        .filter((inspection) => {
          if (inspection.status === "Complete") return false;
          if (!inspection.assigned_crew_ids) return false;
          return inspection.assigned_crew_ids.some((id) => crewIds.includes(id));
        })
        .sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime())
        .slice(0, 10);
    },
    enabled: !!crewMembers,
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Complete":
        return "bg-green-500";
      case "InProgress":
        return "bg-blue-500";
      case "Planned":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  const isOverdue = (date: Date) => {
    return new Date(date) < new Date();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Inspections</CardTitle>
          <CardDescription>Inspections assigned to your crew</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border rounded-lg p-3">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" />
          Upcoming Inspections
        </CardTitle>
        <CardDescription>
          Inspections assigned to your crew (next 10)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!inspections || inspections.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No upcoming inspections for your crew</p>
          </div>
        ) : (
          <div className="space-y-3">
            {inspections.map((inspection) => {
              const overdue = isOverdue(inspection.scheduled_for);
              
              return (
                <div
                  key={inspection.id}
                  className="border rounded-lg p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {inspection.type}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${getPriorityColor(inspection.priority)} text-white`}
                        >
                          {inspection.priority}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${getStatusColor(inspection.status)}`}
                        >
                          {inspection.status}
                        </Badge>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium">{inspection.address}</span>
                      </div>
                    </div>
                    {overdue && (
                      <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span className={overdue ? "text-red-500 font-medium" : ""}>
                      {format(new Date(inspection.scheduled_for), "MMM d, yyyy")}
                      {overdue && " (Overdue)"}
                    </span>
                  </div>
                  {inspection.notes && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {inspection.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
