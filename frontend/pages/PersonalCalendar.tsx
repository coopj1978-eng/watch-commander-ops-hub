import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import backend from "~backend/client";
import CalendarWidget from "../components/CalendarWidget";
import DayModal from "../components/DayModal";
import { useToast } from "@/components/ui/use-toast";
import type { CalendarEvent } from "~backend/calendar/types";
import type { Task } from "~backend/task/types";
import type { Inspection } from "~backend/inspection/types";

interface CalendarItem {
  id: number;
  title: string;
  date: Date;
  type: "event" | "task" | "inspection" | "training";
  color: string;
  data: CalendarEvent | Task | Inspection;
}

type CalendarViewType = "day" | "week" | "month" | "3month" | "year" | "custom";

export default function PersonalCalendar() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>("month");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedItems, setSelectedItems] = useState<CalendarItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const userId = user?.id || "user_123";

  const getDateRange = () => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (view === "month") {
      start.setDate(1);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
    } else if (view === "3month") {
      start.setDate(1);
      end.setMonth(end.getMonth() + 3);
      end.setDate(0);
    } else if (view === "year") {
      start.setMonth(0, 1);
      end.setMonth(11, 31);
    } else if (view === "week") {
      start.setDate(start.getDate() - start.getDay());
      end.setDate(start.getDate() + 6);
    } else {
      end.setDate(end.getDate() + 1);
    }

    return { start, end };
  };

  const { start, end } = getDateRange();

  const { data: events } = useQuery({
    queryKey: ["personal-events", userId, start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const result = await backend.calendar.list({
        user_id: userId,
        start_date: start.toISOString(),
        end_date: end.toISOString(),
      });
      return result.events;
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["personal-tasks", userId, start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const result = await backend.task.list({ assigned_to: userId, limit: 1000 });
      return result.tasks.filter((task) => {
        if (!task.due_at) return false;
        const dueDate = new Date(task.due_at);
        return dueDate >= start && dueDate <= end;
      });
    },
  });

  const { data: inspections } = useQuery({
    queryKey: ["personal-inspections", userId, start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const result = await backend.inspection.list({ limit: 1000 });
      return result.inspections.filter((inspection) => {
        if (!inspection.assigned_crew_ids) return false;
        const scheduledDate = new Date(inspection.scheduled_for);
        return (
          inspection.assigned_crew_ids.includes(userId) &&
          scheduledDate >= start &&
          scheduledDate <= end
        );
      });
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: any) => {
      return backend.calendar.create({
        ...data,
        user_id: userId,
        created_by: userId,
        is_watch_event: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal-events"] });
      toast({
        title: "Success",
        description: "Event created successfully",
      });
      setModalOpen(false);
    },
    onError: (error) => {
      console.error("Create event error:", error);
      toast({
        title: "Error",
        description: "Failed to create event",
        variant: "destructive",
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return backend.calendar.update({ id, ...data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal-events"] });
      toast({
        title: "Success",
        description: "Event updated successfully",
      });
      setModalOpen(false);
    },
    onError: (error) => {
      console.error("Update event error:", error);
      toast({
        title: "Error",
        description: "Failed to update event",
        variant: "destructive",
      });
    },
  });

  const handleDayClick = (date: Date, items: CalendarItem[]) => {
    setSelectedDate(date);
    setSelectedItems(items);
    setModalOpen(true);
  };

  const handleCreateEvent = (data: any) => {
    createEventMutation.mutate(data);
  };

  const handleUpdateEvent = (id: number, data: any) => {
    updateEventMutation.mutate({ id, data });
  };

  const handleExport = async () => {
    try {
      const { start, end } = getDateRange();
      const result = await backend.calendar.exportICS({
        user_id: userId,
        start_date: start.toISOString(),
        end_date: end.toISOString(),
      });

      const blob = new Blob([result.content], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Calendar exported successfully",
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Error",
        description: "Failed to export calendar",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Personal Calendar</h1>
          <p className="text-muted-foreground mt-1">Your personal schedule</p>
        </div>
      </div>

      <CalendarWidget
        events={events || []}
        tasks={tasks || []}
        inspections={inspections || []}
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        view={view}
        onViewChange={setView}
        onDayClick={handleDayClick}
        onExport={handleExport}
      />

      {selectedDate && (
        <DayModal
          date={selectedDate}
          items={selectedItems}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onCreateEvent={handleCreateEvent}
          onUpdateEvent={handleUpdateEvent}
        />
      )}
    </div>
  );
}
