import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import backend from "@/lib/backend";
import type { Inspection } from "~backend/inspection/types";
import InspectionTable from "@/components/InspectionTable";
import InspectionForm from "@/components/InspectionForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Table as TableIcon, Calendar as CalendarIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type ViewMode = "table" | "calendar";

export default function Inspections() {
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | "view">("create");
  const [selectedInspection, setSelectedInspection] = useState<Inspection | undefined>();

  const { data: inspectionsData, isLoading } = useQuery({
    queryKey: ["inspections"],
    queryFn: async () => {
      const result = await backend.inspection.list({ limit: 100 });
      return result;
    },
  });

  const inspections = inspectionsData?.inspections || [];

  const handleCreateNew = () => {
    setSelectedInspection(undefined);
    setFormMode("create");
    setFormOpen(true);
  };

  const handleViewDetails = (inspection: Inspection) => {
    setSelectedInspection(inspection);
    setFormMode("view");
    setFormOpen(true);
  };

  const handleEditInspection = (inspection: Inspection) => {
    setSelectedInspection(inspection);
    setFormMode("edit");
    setFormOpen(true);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Complete: "bg-green-500/10 text-green-500",
      InProgress: "bg-yellow-500/10 text-yellow-500",
      Planned: "bg-blue-500/10 text-blue-500",
    };
    return colors[status] || colors.Planned;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      critical: "bg-red-500/10 text-red-500",
      high: "bg-orange-500/10 text-orange-500",
      medium: "bg-blue-500/10 text-blue-500",
      low: "bg-gray-500/10 text-gray-400",
    };
    return colors[priority] || colors.medium;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      HighRise: "bg-purple-500/10 text-purple-500",
      LocalProperty: "bg-cyan-500/10 text-cyan-500",
      Hydrant: "bg-indigo-500/10 text-indigo-500",
      Other: "bg-gray-500/10 text-gray-400",
    };
    return colors[type] || colors.Other;
  };

  const calendarEvents = inspections.map((inspection) => {
    const date = new Date(inspection.scheduled_for);
    const dateKey = date.toISOString().split("T")[0];
    return { ...inspection, dateKey };
  });

  const eventsByDate = calendarEvents.reduce((acc, event) => {
    if (!acc[event.dateKey]) {
      acc[event.dateKey] = [];
    }
    acc[event.dateKey].push(event);
    return acc;
  }, {} as Record<string, typeof calendarEvents>);

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inspections</h1>
          <p className="text-muted-foreground mt-1">
            {inspections.length} inspection{inspections.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="rounded-r-none"
            >
              <TableIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "calendar" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("calendar")}
              className="rounded-l-none"
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </div>
          <Button className="bg-red-600 hover:bg-red-700" onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            New Inspection
          </Button>
        </div>
      </div>

      {viewMode === "table" ? (
        <InspectionTable
          onViewDetails={handleViewDetails}
          onEditInspection={handleEditInspection}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {monthNames[currentMonth]} {currentYear}
            </CardTitle>
            <CardDescription>Inspection schedule calendar view</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center font-semibold text-sm text-muted-foreground p-2">
                  {day}
                </div>
              ))}
              {emptyDays.map((i) => (
                <div key={`empty-${i}`} className="min-h-24 p-2 border rounded-md bg-muted/20" />
              ))}
              {calendarDays.map((day) => {
                const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayEvents = eventsByDate[dateKey] || [];
                const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
                
                return (
                  <div
                    key={day}
                    className={`min-h-24 p-2 border rounded-md ${
                      isToday ? "border-red-600 bg-red-50 dark:bg-red-950/20" : "bg-card"
                    }`}
                  >
                    <div className="text-sm font-medium mb-1">{day}</div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          onClick={() => handleViewDetails(event)}
                          className="text-xs p-1 rounded cursor-pointer hover:opacity-80 transition-opacity"
                          style={{
                            backgroundColor: event.type === "HighRise" ? "rgba(168, 85, 247, 0.1)" :
                                           event.type === "LocalProperty" ? "rgba(34, 211, 238, 0.1)" :
                                           event.type === "Hydrant" ? "rgba(99, 102, 241, 0.1)" :
                                           "rgba(156, 163, 175, 0.1)",
                          }}
                        >
                          <div className="font-medium truncate">{event.type}</div>
                          <div className="truncate text-muted-foreground">{event.address}</div>
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-muted-foreground text-center">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && inspections.length === 0 && viewMode === "table" && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No inspections yet</p>
            <Button
              className="mt-4 bg-red-600 hover:bg-red-700"
              onClick={handleCreateNew}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create your first inspection
            </Button>
          </CardContent>
        </Card>
      )}

      <InspectionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        inspection={selectedInspection}
        mode={formMode}
      />
    </div>
  );
}
