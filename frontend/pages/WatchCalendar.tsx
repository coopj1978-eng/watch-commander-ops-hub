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
import { ClipboardPlus, CalendarDays, GraduationCap, Filter, X } from "lucide-react";
import ScheduleTrainingDialog from "@/components/ScheduleTrainingDialog";

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

  // Schedule Training modal — opens from the calendar toolbar
  const [trainingModalOpen, setTrainingModalOpen] = useState(false);

  // Mobile filters drawer — desktop has a permanent sidebar, so this is only
  // consulted below the md breakpoint.
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  // Shared filter content — rendered in the permanent desktop sidebar AND
  // in the mobile drawer so both stay in sync without code duplication.
  const filterContent = (
    <>
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
    </>
  );

  return (
    <div className="flex overflow-hidden" style={{ height: "calc(100vh - 160px)" }}>
      {/* ── Desktop sidebar — permanent ────────────────────────────────────── */}
      <aside className="hidden md:flex w-52 shrink-0 border-r border-border bg-card flex-col py-4 px-3 gap-6 h-full overflow-y-auto">
        {filterContent}
      </aside>

      {/* ── Mobile filters drawer — slides in from the left ───────────────── */}
      <div
        className={`md:hidden fixed inset-0 z-40 transition-opacity ${
          filtersOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40"
          onClick={() => setFiltersOpen(false)}
        />
        {/* Panel */}
        <aside
          className={`absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-card border-r border-border flex flex-col py-4 px-3 gap-6 overflow-y-auto transition-transform shadow-xl ${
            filtersOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <h2 className="text-sm font-semibold">Calendars</h2>
            <button
              type="button"
              className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center"
              onClick={() => setFiltersOpen(false)}
              aria-label="Close filters"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {filterContent}
        </aside>
      </div>

      {/* ── Main calendar area ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden p-2 md:p-4">
        {/* Toolbar — on mobile the button labels are hidden so three icon-only
            buttons fit comfortably on a 375px screen. On sm+ the full label
            shows again.  Each button is at least 40x40 to meet tap-target
            minimums. */}
        <div className="flex items-center gap-1.5 md:gap-2 mb-2 shrink-0">
          {/* Mobile-only: open the calendar filters drawer */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFiltersOpen(true)}
            className="md:hidden h-10 w-10 px-0 flex items-center justify-center"
            aria-label="Filters"
          >
            <Filter className="h-4 w-4" />
          </Button>

          <div className="flex-1 md:hidden" />

          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShiftAdjDate(undefined); setShiftAdjModalOpen(true); }}
            className="h-10 sm:h-9 w-10 sm:w-auto px-0 sm:px-3 flex items-center justify-center sm:gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 md:ml-auto"
            aria-label="Log Shift"
          >
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">Log Shift</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setInspectionModalOpen(true)}
            className="h-10 sm:h-9 w-10 sm:w-auto px-0 sm:px-3 flex items-center justify-center sm:gap-1.5 border-orange-200 text-orange-700 hover:bg-orange-50"
            aria-label="New Inspection"
          >
            <ClipboardPlus className="h-4 w-4" />
            <span className="hidden sm:inline">New Inspection</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTrainingModalOpen(true)}
            className="h-10 sm:h-9 w-10 sm:w-auto px-0 sm:px-3 flex items-center justify-center sm:gap-1.5 border-teal-200 text-teal-700 hover:bg-teal-50"
            aria-label="Schedule Training"
          >
            <GraduationCap className="h-4 w-4" />
            <span className="hidden sm:inline">Schedule Training</span>
          </Button>
        </div>
        <CalendarWidget
          events={allEvents as any}
          tasks={(visibleCalendars.has("tasks") ? tasks : []) as any}
          inspections={(visibleCalendars.has("inspections") ? inspections : []) as any}
          shiftSchedule={shiftSchedule}
          userWatch={visibleCalendars.has("shifts") ? userWatch : undefined}
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

      {/* ── Schedule Training modal ──────────────────────────────────────────── */}
      <ScheduleTrainingDialog
        open={trainingModalOpen}
        onOpenChange={setTrainingModalOpen}
        watch={userWatch}
      />
    </div>
  );
}
