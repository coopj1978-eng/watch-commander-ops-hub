import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import CalendarWidget, { type CalendarViewType, type CalendarItem } from "../components/CalendarWidget";
import EventForm, { type EventFormData } from "../components/EventForm";
import InspectionEventModal, { type ExistingInspectionEvent } from "../components/InspectionEventModal";
import ShiftAdjustmentModal from "@/components/ShiftAdjustmentModal";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import type { CalendarVisibility } from "~backend/calendar/types";
import type { Task } from "~backend/task/types";
import type { Inspection } from "~backend/inspection/types";
import { getShiftsForDateRange, hasRotaConfig } from "@/lib/shiftRota";
import { ClipboardPlus, CalendarDays } from "lucide-react";

// ─── Calendar sidebar config ──────────────────────────────────────────────────
const CALENDARS: { key: CalendarVisibility; label: string; sublabel: string; color: string }[] = [
  {
    key: "station",
    label: "Springburn Station",
    sublabel: "All station staff",
    color: "#ef4444",
  },
  {
    key: "watch",
    label: "Watch Calendar",
    sublabel: "Your watch only",
    color: "#3b82f6",
  },
  {
    key: "personal",
    label: "Personal",
    sublabel: "Only you",
    color: "#8b5cf6",
  },
];

const OTHER_CALENDARS = [
  { key: "tasks", label: "Tasks", color: "#0ea5e9" },
  { key: "inspections", label: "Inspections", color: "#f97316" },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function UnifiedCalendar() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = user?.id ?? "user_123";

  // View state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>("month");

  // Calendar visibility toggles
  const [visibleCalendars, setVisibleCalendars] = useState<Set<string>>(
    new Set(["station", "watch", "personal", "tasks", "inspections", "shifts"])
  );

  // Shift rota
  const userWatch = user?.watch_unit ?? "";
  const rotaAvailable = hasRotaConfig(userWatch);

  // Event form dialog
  const [formOpen, setFormOpen] = useState(false);
  const [formDate, setFormDate] = useState<Date>(new Date());
  const [editingEvent, setEditingEvent] = useState<CalendarItem | null>(null);
  const [defaultCalendar, setDefaultCalendar] = useState<CalendarVisibility>("station");

  // Inspection event modal
  const [inspectionModalOpen, setInspectionModalOpen] = useState(false);
  const [editingInspectionEvent, setEditingInspectionEvent] = useState<ExistingInspectionEvent | null>(null);

  // Shift adjustment modal
  const [shiftAdjModalOpen, setShiftAdjModalOpen] = useState(false);
  const [shiftAdjDate, setShiftAdjDate] = useState<Date | undefined>(undefined);

  // ─── Date range for queries ─────────────────────────────────────────────────
  const getDateRange = () => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);
    if (view === "month") {
      start.setDate(1);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
    } else if (view === "year") {
      start.setMonth(0, 1);
      end.setMonth(11, 31);
    } else if (view === "week") {
      const day = start.getDay();
      const offset = day === 0 ? -6 : 1 - day;
      start.setDate(start.getDate() + offset);
      end.setDate(start.getDate() + 6);
    } else {
      end.setDate(end.getDate() + 1);
    }
    return { start, end };
  };

  const { start, end } = getDateRange();
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  // ─── Queries ────────────────────────────────────────────────────────────────
  const { data: stationEvents = [] } = useQuery({
    queryKey: ["cal-station", startISO, endISO],
    queryFn: async () => {
      const r = await backend.calendar.list({
        calendar_visibility: "station" as any,
        start_date: startISO,
        end_date: endISO,
      });
      return r.events;
    },
    enabled: visibleCalendars.has("station"),
  });

  const { data: watchEvents = [] } = useQuery({
    queryKey: ["cal-watch", userId, startISO, endISO],
    queryFn: async () => {
      const r = await backend.calendar.list({
        calendar_visibility: "watch" as any,
        user_id: userId,
        start_date: startISO,
        end_date: endISO,
      });
      return r.events;
    },
    enabled: visibleCalendars.has("watch"),
  });

  const { data: personalEvents = [] } = useQuery({
    queryKey: ["cal-personal", userId, startISO, endISO],
    queryFn: async () => {
      const r = await backend.calendar.list({
        calendar_visibility: "personal" as any,
        user_id: userId,
        start_date: startISO,
        end_date: endISO,
      });
      return r.events;
    },
    enabled: visibleCalendars.has("personal"),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["cal-tasks", userId, startISO, endISO],
    queryFn: async () => {
      const r = await backend.task.list({ assigned_to: userId, limit: 500 });
      return r.tasks.filter((t) => {
        if (!t.due_at) return false;
        const d = new Date(t.due_at as string);
        return d >= start && d <= end;
      });
    },
    enabled: visibleCalendars.has("tasks"),
  });

  const { data: inspections = [] } = useQuery({
    queryKey: ["cal-inspections", userId, startISO, endISO],
    queryFn: async () => {
      const r = await backend.inspection.list({ limit: 500 });
      return r.inspections.filter((ins) => {
        const d = new Date(ins.scheduled_for as string);
        return d >= start && d <= end;
      });
    },
    enabled: visibleCalendars.has("inspections"),
  });

  // ─── Mutations ───────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: EventFormData) =>
      backend.calendar.create({
        title: data.title,
        description: data.description,
        event_type: data.event_type as any,
        calendar_visibility: data.calendar_visibility,
        start_time: data.start_time instanceof Date ? data.start_time.toISOString() : data.start_time,
        end_time: data.end_time instanceof Date ? data.end_time.toISOString() : data.end_time,
        all_day: data.all_day,
        // Only set user_id for personal events — station/watch events are shared
        user_id: data.calendar_visibility === "personal" ? userId : undefined,
        is_watch_event: data.is_watch_event,
        location: data.location,
        created_by: userId,
      }),
    onSuccess: () => {
      invalidateCalendarQueries();
      toast({ title: "Event created" });
      setFormOpen(false);
    },
    onError: () => toast({ title: "Failed to create event", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: EventFormData }) =>
      backend.calendar.update(id, {
        user_id: userId,
        updates: {
          title: data.title,
          description: data.description,
          event_type: data.event_type as any,
          calendar_visibility: data.calendar_visibility,
          start_time: data.start_time instanceof Date ? data.start_time.toISOString() : data.start_time,
          end_time: data.end_time instanceof Date ? data.end_time.toISOString() : data.end_time,
          all_day: data.all_day,
          location: data.location,
        },
      }),
    onSuccess: () => {
      invalidateCalendarQueries();
      toast({ title: "Event updated" });
      setFormOpen(false);
      setEditingEvent(null);
    },
    onError: () => toast({ title: "Failed to update event", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => backend.calendar.deleteEvent(id, { user_id: userId }),
    onSuccess: () => {
      invalidateCalendarQueries();
      toast({ title: "Event deleted" });
      setFormOpen(false);
      setEditingEvent(null);
    },
    onError: () => toast({ title: "Failed to delete event", variant: "destructive" }),
  });

  function invalidateCalendarQueries() {
    queryClient.invalidateQueries({ queryKey: ["cal-station"] });
    queryClient.invalidateQueries({ queryKey: ["cal-watch"] });
    queryClient.invalidateQueries({ queryKey: ["cal-personal"] });
  }

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleSlotClick = (date: Date) => {
    setFormDate(date);
    setEditingEvent(null);
    setDefaultCalendar("station");
    setFormOpen(true);
  };

  const handleEventClick = (item: CalendarItem) => {
    if (item.type === "task" || item.type === "inspection") return; // non-editable

    // If this event has an inspection source, open the inspection edit modal
    const eventData = item.data as any;
    if (eventData?.source_type) {
      setEditingInspectionEvent({
        id: eventData.id,
        title: eventData.title,
        source_type: eventData.source_type,
        source_id: eventData.source_id ?? null,
        location: eventData.location ?? null,
        start_time: typeof eventData.start_time === "string" ? eventData.start_time : eventData.start_time?.toISOString(),
        end_time: typeof eventData.end_time === "string" ? eventData.end_time : eventData.end_time?.toISOString(),
        calendar_visibility: eventData.calendar_visibility ?? "watch",
        color: eventData.color ?? null,
      });
      setInspectionModalOpen(true);
      return;
    }

    // Standard calendar event form
    setFormDate(item.startTime);
    setEditingEvent(item);
    setDefaultCalendar(item.calendarType as CalendarVisibility);
    setFormOpen(true);
  };

  const handleFormSubmit = (data: EventFormData) => {
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = () => {
    if (editingEvent) deleteMutation.mutate(editingEvent.id);
  };

  const toggleCalendar = (key: string) => {
    setVisibleCalendars((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ─── Shift schedule (computed, no network call needed) ───────────────────────
  const shiftSchedule = useMemo(() => {
    if (!rotaAvailable || !visibleCalendars.has("shifts")) return [];
    return getShiftsForDateRange(userWatch, new Date(startISO), new Date(endISO));
  }, [userWatch, rotaAvailable, startISO, endISO, visibleCalendars]);

  // ─── Render ──────────────────────────────────────────────────────────────────
  const allEvents = [
    ...(visibleCalendars.has("station") ? stationEvents : []),
    ...(visibleCalendars.has("watch") ? watchEvents : []),
    ...(visibleCalendars.has("personal") ? personalEvents : []),
  ];

  return (
    <div className="flex overflow-hidden" style={{ height: "calc(100vh - 160px)" }}>
      {/* ── Sidebar (desktop only) ─────────────────────────────────────────── */}
      <aside className="hidden md:flex w-52 shrink-0 border-r border-border bg-card flex-col py-4 px-3 gap-6 h-full overflow-y-auto">
        {/* My Calendars */}
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
            My Calendars
          </p>
          <div className="space-y-1">
            {CALENDARS.map(({ key, label, sublabel, color }) => {
              const active = visibleCalendars.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                  onClick={() => toggleCalendar(key)}
                >
                  {/* Checkbox dot */}
                  <span
                    className="w-3 h-3 rounded-full shrink-0 border-2 transition-colors"
                    style={{
                      backgroundColor: active ? color : "transparent",
                      borderColor: color,
                    }}
                  />
                  <div className="min-w-0">
                    <div className={`text-xs font-medium truncate ${active ? "text-foreground" : "text-muted-foreground"}`}>
                      {label}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{sublabel}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Other */}
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
            Other
          </p>
          <div className="space-y-1">
            {OTHER_CALENDARS.map(({ key, label, color }) => {
              const active = visibleCalendars.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                  onClick={() => toggleCalendar(key)}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0 border-2 transition-colors"
                    style={{
                      backgroundColor: active ? color : "transparent",
                      borderColor: color,
                    }}
                  />
                  <span className={`text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Shift Rota */}
        {rotaAvailable && (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
              Shift Rota
            </p>
            <div className="space-y-1">
              <button
                type="button"
                className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                onClick={() => toggleCalendar("shifts")}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0 border-2 transition-colors"
                  style={{
                    backgroundColor: visibleCalendars.has("shifts") ? "#ca8a04" : "transparent",
                    borderColor: "#ca8a04",
                  }}
                />
                <div className="min-w-0">
                  <div className={`text-xs font-medium truncate ${visibleCalendars.has("shifts") ? "text-foreground" : "text-muted-foreground"}`}>
                    {userWatch} Watch Shifts
                  </div>
                  <div className="flex gap-1.5 mt-0.5">
                    <span className="text-[9px] px-1 rounded text-white font-medium" style={{ backgroundColor: "#ca8a04" }}>☀️ Day</span>
                    <span className="text-[9px] px-1 rounded text-white font-medium" style={{ backgroundColor: "#4338ca" }}>🌙 Night</span>
                    <span className="text-[9px] px-1 rounded text-white font-medium" style={{ backgroundColor: "#16a34a" }}>🌿 Leave</span>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-auto">
          <p className="text-[10px] text-muted-foreground px-1 leading-relaxed">
            Click a calendar to show/hide its events
          </p>
        </div>
      </aside>

      {/* ── Main calendar area ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden p-4">
        {/* Toolbar */}
        <div className="flex items-center justify-end gap-2 mb-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShiftAdjDate(undefined); setShiftAdjModalOpen(true); }}
            className="flex items-center gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          >
            <CalendarDays className="h-4 w-4" />
            Log Shift
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setInspectionModalOpen(true)}
            className="flex items-center gap-1.5 border-orange-200 text-orange-700 hover:bg-orange-50"
          >
            <ClipboardPlus className="h-4 w-4" />
            New Inspection
          </Button>
        </div>
        <CalendarWidget
          events={allEvents as any}
          tasks={(visibleCalendars.has("tasks") ? tasks : []) as any}
          inspections={(visibleCalendars.has("inspections") ? inspections : []) as any}
          shiftSchedule={shiftSchedule}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          view={view}
          onViewChange={setView}
          onSlotClick={handleSlotClick}
          onEventClick={handleEventClick}
        />
      </div>

      {/* ── Event form dialog ───────────────────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) { setFormOpen(false); setEditingEvent(null); } }}>
        <DialogContent className="p-0 bg-transparent border-none shadow-none max-w-md w-full">
          <DialogTitle className="sr-only">{editingEvent ? "Edit Event" : "New Event"}</DialogTitle>
          <EventForm
            date={formDate}
            initialData={editingEvent?.data as any}
            defaultCalendar={defaultCalendar}
            onSubmit={handleFormSubmit}
            onCancel={() => { setFormOpen(false); setEditingEvent(null); }}
            onDelete={editingEvent ? handleDelete : undefined}
          />
        </DialogContent>
      </Dialog>

      {/* ── Inspection event modal (create + edit) ──────────────────────────── */}
      <InspectionEventModal
        open={inspectionModalOpen}
        onClose={() => { setInspectionModalOpen(false); setEditingInspectionEvent(null); }}
        defaultDate={formDate}
        editingEvent={editingInspectionEvent}
      />

      {/* ── Shift adjustment modal ───────────────────────────────────────────── */}
      <ShiftAdjustmentModal
        open={shiftAdjModalOpen}
        onClose={() => setShiftAdjModalOpen(false)}
        defaultDate={shiftAdjDate}
      />
    </div>
  );
}
