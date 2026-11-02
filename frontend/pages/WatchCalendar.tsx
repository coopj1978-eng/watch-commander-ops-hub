import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/App";
import { useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { useUserRole } from "@/lib/rbac";
import backend from "@/lib/backend";
import type { shift_adjustments } from "@/client";
import CalendarWidget, { type CalendarViewType, type CalendarItem, type CalendarAnchor } from "../components/CalendarWidget";
import CalendarFilters from "../components/CalendarFilters";
import { CalendarNewButton, CalendarNewFab, type NewKind } from "../components/CalendarNewMenu";
import { CALENDAR_EVENTS_KEY, refreshCalendar } from "@/lib/calendarQueries";
import EventForm, { type EventFormData } from "../components/EventForm";
import InspectionEventModal, { type ExistingInspectionEvent } from "../components/InspectionEventModal";
import ShiftAdjustmentModal from "@/components/ShiftAdjustmentModal";
import { useToast } from "@/components/ui/use-toast";
import type { CalendarVisibility } from "~backend/calendar/types";
import type { Task } from "~backend/task/types";
import type { Inspection } from "~backend/inspection/types";
import { getShiftsForDateRange, hasRotaConfig } from "@/lib/shiftRota";
import ScheduleTrainingDialog from "@/components/ScheduleTrainingDialog";

// ─── Component ────────────────────────────────────────────────────────────────
// One calendar (Nov 2026 redesign): the grid gets the full width, with one
// header — where you are, which calendars, the view, and "New". The old left
// panel went: its mini month repeated the grid, and "Next up" repeated the
// shift shown on Home and in the title bar.
export default function UnifiedCalendar() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = user?.id ?? "user_123";

  // View state
  // "?date=YYYY-MM-DD" (e.g. from the Tasks page's watch calendar) opens that day.
  const [searchParams, setSearchParams] = useSearchParams();
  const dateParam = searchParams.get("date");
  const [currentDate, setCurrentDate] = useState(() =>
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? new Date(`${dateParam}T12:00:00`) : new Date()
  );
  const [view, setView] = useState<CalendarViewType>(dateParam ? "day" : "month");

  // Calendar visibility toggles
  const [visibleCalendars, setVisibleCalendars] = useState<Set<string>>(
    new Set(["station", "watch", "personal", "tasks", "inspections", "shifts"])
  );

  // Shift rota
  const userWatch = user?.watch_unit ?? "";


  // Event form dialog
  const [formOpen, setFormOpen] = useState(false);
  const [formDate, setFormDate] = useState<Date>(new Date());
  const [editingEvent, setEditingEvent] = useState<CalendarItem | null>(null);
  // Where the form pops up (beside the click on desktop; a sheet on phones),
  // and the dashed "new event" slot shown in Day/Week while adding.
  const [formAnchor, setFormAnchor] = useState<CalendarAnchor | null>(null);
  const [pendingSlot, setPendingSlot] = useState<Date | null>(null);
  const [defaultCalendar, setDefaultCalendar] = useState<CalendarVisibility>("station");
  // New events start on the calendar this person last picked (kept on this
  // device) until they pick another.
  const lastCalendarKey = `cal-last-calendar:${userId}`;
  const lastCalendar = (): CalendarVisibility => {
    try {
      const saved = localStorage.getItem(lastCalendarKey);
      if (saved === "station" || saved === "watch" || saved === "personal") return saved;
    } catch { /* storage unavailable */ }
    return "station";
  };
  const rememberCalendar = (calendar: CalendarVisibility) => {
    try { localStorage.setItem(lastCalendarKey, calendar); } catch { /* storage unavailable */ }
  };

  // Inspection event modal
  const [inspectionModalOpen, setInspectionModalOpen] = useState(false);
  const [editingInspectionEvent, setEditingInspectionEvent] = useState<ExistingInspectionEvent | null>(null);

  // Shift adjustment modal
  const [shiftAdjModalOpen, setShiftAdjModalOpen] = useState(false);
  const [shiftAdjDate, setShiftAdjDate] = useState<Date | undefined>(undefined);
  // A booking clicked on the calendar opens in the booking form, so its
  // TOIL hours, cover and linked entries stay in step.
  const [bookingToEdit, setBookingToEdit] = useState<shift_adjustments.ShiftAdjustment | null>(null);
  const role = useUserRole();
  const isManager = role === "WC" || role === "CC";
  // A WC/CC can look at (and add to / change) another watch's calendar —
  // things move while a watch is off shift.
  const [viewWatch, setViewWatch] = useState("");
  const watchShown = (isManager && viewWatch) || userWatch;

  // Schedule Training modal — opens from "New"
  const [trainingModalOpen, setTrainingModalOpen] = useState(false);

  // Phones always show a month with the picked day under it.
  const isPhone = typeof window !== "undefined" && window.innerWidth < 768;
  const rangeView: CalendarViewType = isPhone ? "month" : view;

  // ─── Date range for queries ─────────────────────────────────────────────────
  const getDateRange = () => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);
    if (rangeView === "month") {
      start.setDate(1);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
    } else if (rangeView === "year") {
      start.setMonth(0, 1);
      end.setMonth(11, 31);
    } else if (rangeView === "week") {
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
  // Everything you may see in the range, in one go — the server applies the
  // calendar's rules (no one else's personal entries or reminders; watch
  // events for the watch shown). The calendars menu then filters on screen.
  const { data: rangeEvents = [] } = useQuery({
    queryKey: [CALENDAR_EVENTS_KEY, watchShown, startISO, endISO],
    queryFn: async () => {
      const r = await backend.calendar.list({
        watch: isManager ? watchShown : undefined,
        start_date: startISO,
        end_date: endISO,
        limit: 1000,
      });
      return r.events;
    },
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
        // Watch events go on the watch calendar being viewed.
        watch: data.calendar_visibility === "watch" ? watchShown : undefined,
        created_by: userId,
      }),
    onSuccess: () => {
      invalidateCalendarQueries();
      toast({ title: "Event created" });
      closeForm();
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
          change_note: data.change_note,
        },
      }),
    onSuccess: () => {
      invalidateCalendarQueries();
      toast({ title: "Event updated" });
      closeForm();
    },
    onError: () => toast({ title: "Failed to update event", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => backend.calendar.deleteEvent(id, { user_id: userId }),
    onSuccess: () => {
      invalidateCalendarQueries();
      toast({ title: "Event deleted" });
      closeForm();
    },
    onError: () => toast({ title: "Failed to delete event", variant: "destructive" }),
  });

  // Strike through (kept on the calendar with the reason) / reinstate.
  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      backend.calendar.cancelEvent(id, { reason }),
    onSuccess: () => {
      invalidateCalendarQueries();
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Event struck through", description: "It stays on the calendar with your reason." });
      closeForm();
    },
    onError: (err: any) =>
      toast({ title: "Couldn't cancel event", description: err?.message, variant: "destructive" }),
  });

  const reinstateMutation = useMutation({
    mutationFn: (id: number) => backend.calendar.reinstateEvent(id),
    onSuccess: () => {
      invalidateCalendarQueries();
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Event reinstated" });
      closeForm();
    },
    onError: (err: any) =>
      toast({ title: "Couldn't reinstate event", description: err?.message, variant: "destructive" }),
  });

  function invalidateCalendarQueries() {
    refreshCalendar(queryClient);
  }

  // Escape closes the add/edit panel.
  useEffect(() => {
    if (!formOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeForm(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [formOpen]);

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleSlotClick = (date: Date, anchor?: CalendarAnchor) => {
    setFormDate(date);
    setEditingEvent(null);
    setDefaultCalendar(lastCalendar());
    setFormAnchor(anchor ?? null);
    setPendingSlot(view === "week" || view === "day" ? date : null);
    setFormOpen(true);
  };

  // "?new=1" (the quick-add button) opens a new event at the next hour.
  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    setSearchParams((p) => { p.delete("new"); return p; }, { replace: true });
    const at = new Date();
    at.setHours(at.getHours() + 1, 0, 0, 0);
    handleSlotClick(at);
  }, [searchParams]);

  const closeForm = () => {
    setFormOpen(false);
    setEditingEvent(null);
    setFormAnchor(null);
    setPendingSlot(null);
  };

  const handleEventClick = async (item: CalendarItem, anchor?: CalendarAnchor) => {
    if (item.type === "task" || item.type === "inspection") return; // non-editable

    const eventData = item.data as any;

    // TOIL / H4H / Flexi etc. — the person it belongs to, the person
    // covering, or a WC/CC edit it as a booking. Anyone else just sees it.
    if (eventData?.shift_adjustment_id) {
      const booking = await backend.shift_adjustments
        .list({ id: eventData.shift_adjustment_id })
        .then((r) => r.adjustments[0])
        .catch(() => undefined);
      const canEdit =
        !!booking &&
        (booking.user_id === user?.id ||
          booking.covering_user_id === user?.id ||
          role === "WC" ||
          role === "CC");
      if (canEdit) {
        setBookingToEdit(booking);
        return;
      }
    }

    // If this event has an inspection source, open the inspection edit modal
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
    setFormAnchor(anchor ?? null);
    setPendingSlot(null);
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
    if (!editingEvent) return;
    const isBooking = !!(editingEvent.data as { shift_adjustment_id?: number | null })?.shift_adjustment_id;
    const message = isBooking
      ? `Delete "${editingEvent.title}"?\n\nThis cancels the whole booking (TOIL/H4H/Flexi): any TOIL hours are refunded and the cover entries are removed.`
      : `Delete "${editingEvent.title}"? This cannot be undone.`;
    if (confirm(message)) deleteMutation.mutate(editingEvent.id);
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
    // The shift pattern of the watch whose calendar is being viewed.
    if (!hasRotaConfig(watchShown) || !visibleCalendars.has("shifts")) return [];
    return getShiftsForDateRange(watchShown, new Date(startISO), new Date(endISO));
  }, [watchShown, startISO, endISO, visibleCalendars]);

  // ─── Render ──────────────────────────────────────────────────────────────────
  // Personal is strictly yours: an entry you logged for someone else (their
  // TOIL, say) already shows on the watch calendar.
  const allEvents = rangeEvents.filter((e) => {
    const cal = e.calendar_visibility ?? "station";
    if (cal === "personal") return visibleCalendars.has("personal") && e.user_id === userId;
    return visibleCalendars.has(cal);
  });

  // "New": an event starts on the day in view (the next hour if that's
  // today); the other forms open with that day too.
  const newDay = (() => {
    const today = new Date();
    const inRange = today >= start && today <= new Date(end.getTime() + 86400000);
    const base = isPhone ? new Date(currentDate) : inRange ? today : new Date(start);
    if (base.toDateString() === today.toDateString()) {
      base.setHours(today.getHours() + 1, 0, 0, 0);
    } else {
      base.setHours(9, 0, 0, 0);
    }
    return base;
  })();

  const onNew = (kind: NewKind) => {
    if (kind === "event") handleSlotClick(newDay);
    else if (kind === "shift") { setShiftAdjDate(newDay); setShiftAdjModalOpen(true); }
    else if (kind === "inspection") { setFormDate(newDay); setInspectionModalOpen(true); }
    else setTrainingModalOpen(true);
  };

  const filters = (
    <CalendarFilters
      visible={visibleCalendars}
      onToggle={toggleCalendar}
      watchShown={watchShown}
      userWatch={userWatch}
      isManager={isManager}
      onWatchChange={setViewWatch}
      compact={isPhone}
    />
  );

  // Where the add/edit panel sits: beside the click on desktop, a bottom
  // sheet on phones (or centred if there's no click position).
  const PANEL_W = 380;
  const panelStyle: React.CSSProperties = (() => {
    const base: React.CSSProperties = {
      position: "absolute", background: "var(--cal-surface)", border: "1px solid var(--cal-line)",
      boxShadow: "var(--cal-pop)", overflowY: "auto", boxSizing: "border-box",
    };
    if (isPhone) {
      return { ...base, left: 0, right: 0, bottom: 0, maxHeight: "92vh", borderRadius: "24px 24px 0 0" };
    }
    if (!formAnchor) {
      return { ...base, left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: PANEL_W, maxHeight: "calc(100vh - 32px)", borderRadius: 22 };
    }
    const vw = window.innerWidth, vh = window.innerHeight;
    const right = formAnchor.x + 16;
    const left = right + PANEL_W <= vw - 16 ? right : Math.max(16, formAnchor.x - 16 - PANEL_W);
    const top = Math.max(16, Math.min(formAnchor.y - 160, vh - 16 - 620));
    return { ...base, left, top, width: PANEL_W, maxHeight: vh - top - 16, borderRadius: 22 };
  })();

  return (
    <div className="cal-ui">
      <CalendarWidget
        events={allEvents as any}
        tasks={(visibleCalendars.has("tasks") ? tasks : []) as any}
        inspections={(visibleCalendars.has("inspections") ? inspections : []) as any}
        shiftSchedule={shiftSchedule}
        userWatch={visibleCalendars.has("shifts") ? watchShown : undefined}
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        view={view}
        onViewChange={setView}
        onSlotClick={handleSlotClick}
        onEventClick={handleEventClick}
        pendingSlot={formOpen && !editingEvent ? pendingSlot : null}
        filters={filters}
        newButton={<CalendarNewButton onPick={onNew} />}
      />

      {/* Phones: the calendar's own "+" (the app-wide one is hidden here) */}
      <CalendarNewFab
        onPick={onNew}
        dayLabel={currentDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
      />

      {/* ── Add / edit event panel ────────────────────────────────────────── */}
      {/* Portalled to <body> above the phone bottom bar, so its buttons aren't hidden behind it */}
      {formOpen && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 60 }}>
          <div
            onClick={closeForm}
            style={{ position: "absolute", inset: 0, background: isPhone || !formAnchor ? "rgba(0,0,0,.4)" : "rgba(17,20,39,.06)" }}
          />
          <div role="dialog" aria-modal="true" aria-label={editingEvent ? "Edit event" : "New event"} style={panelStyle}>
            <EventForm
              key={editingEvent ? `edit-${editingEvent.id}` : `new-${formDate.getTime()}`}
              date={formDate}
              initialData={editingEvent?.data as any}
              defaultCalendar={defaultCalendar}
              watchName={watchShown}
              onSubmit={handleFormSubmit}
              onCancel={closeForm}
              onDelete={editingEvent ? handleDelete : undefined}
              onStrike={editingEvent ? (reason) => cancelMutation.mutate({ id: editingEvent.id, reason }) : undefined}
              onReinstate={editingEvent ? () => reinstateMutation.mutate(editingEvent.id) : undefined}
              onCalendarPick={editingEvent ? undefined : rememberCalendar}
            />
          </div>
        </div>,
        document.body
      )}

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
      <ShiftAdjustmentModal
        open={!!bookingToEdit}
        onClose={() => setBookingToEdit(null)}
        editAdjustment={bookingToEdit}
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
