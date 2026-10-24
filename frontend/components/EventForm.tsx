import { useState, useEffect, useRef } from "react";
import { X, MapPin, FileText, Calendar, Clock, Ban, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CalendarEvent, CalendarVisibility } from "~backend/calendar/types";

interface EventFormProps {
  date: Date;
  initialData?: CalendarEvent;
  defaultCalendar?: CalendarVisibility;
  /** The watch whose calendar is being viewed (a WC/CC can pick another). */
  watchName?: string;
  onSubmit: (data: EventFormData) => void;
  onCancel: () => void;
  onDelete?: () => void;
  /** Strike the event through with a reason — it stays on the calendar. */
  onStrike?: (reason: string) => void;
  onReinstate?: () => void;
}

export interface EventFormData {
  title: string;
  description: string;
  location: string;
  calendar_visibility: CalendarVisibility;
  event_type: string;
  start_time: Date;
  end_time: Date;
  all_day: boolean;
  is_watch_event: boolean;
  /** Why it was changed — asked for when the date moves. */
  change_note?: string;
}

// ─── Calendar options ─────────────────────────────────────────────────────────
const CALENDAR_OPTIONS: { value: CalendarVisibility; label: string; sublabel: string; color: string }[] = [
  {
    value: "station",
    label: "Springburn Station",
    sublabel: "Visible to all Springburn staff",
    color: "#ef4444",
  },
  {
    value: "watch",
    label: "Watch Calendar",
    sublabel: "Visible to your watch only",
    color: "#3b82f6",
  },
  {
    value: "personal",
    label: "Personal Calendar",
    sublabel: "Only visible to you",
    color: "#8b5cf6",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toInputTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function parseDateTimeInputs(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDisplayTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true });
}

// ─── Row wrapper ──────────────────────────────────────────────────────────────
function FormRow({ icon: Icon, children }: { icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-2.5 border-b border-border/40 last:border-0">
      <div className="w-5 shrink-0 mt-0.5">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function EventForm({
  date,
  initialData,
  defaultCalendar = "station",
  watchName,
  onSubmit,
  onCancel,
  onDelete,
  onStrike,
  onReinstate,
}: EventFormProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const isEditing = !!initialData;

  // Default start = date passed in (rounded to 30-min boundary), end = +1 hour
  const defaultStart = (() => {
    const d = new Date(date);
    const minutes = Math.round(d.getMinutes() / 30) * 30;
    d.setMinutes(minutes, 0, 0);
    return d;
  })();
  const defaultEnd = new Date(defaultStart.getTime() + 3600000);

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [startDate, setStartDate] = useState(
    toInputDate(initialData ? new Date(initialData.start_time) : defaultStart)
  );
  const [startTime, setStartTime] = useState(
    toInputTime(initialData ? new Date(initialData.start_time) : defaultStart)
  );
  const [endDate, setEndDate] = useState(
    toInputDate(initialData ? new Date(initialData.end_time) : defaultEnd)
  );
  const [endTime, setEndTime] = useState(
    toInputTime(initialData ? new Date(initialData.end_time) : defaultEnd)
  );
  const [allDay, setAllDay] = useState(initialData?.all_day ?? false);
  const [calendar, setCalendar] = useState<CalendarVisibility>(
    initialData?.calendar_visibility ?? defaultCalendar
  );
  const [location, setLocation] = useState(initialData?.location ?? "");
  const [notes, setNotes] = useState(initialData?.description ?? "");
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [striking, setStriking] = useState(false);
  const [strikeReason, setStrikeReason] = useState("");
  const cancelled = !!initialData?.cancelled_at;
  // Bookings (TOIL / H4H…) are changed from their booking form, not here.
  const canStrike = isEditing && !!onStrike && !(initialData as { shift_adjustment_id?: number | null } | undefined)?.shift_adjustment_id;

  // Auto-focus title
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // When start changes, ensure end is at least start + 30 min
  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    const newStart = parseDateTimeInputs(val, startTime);
    const newEnd = parseDateTimeInputs(endDate, endTime);
    if (newEnd <= newStart) {
      const adjusted = new Date(newStart.getTime() + 3600000);
      setEndDate(toInputDate(adjusted));
      setEndTime(toInputTime(adjusted));
    }
  };

  const handleStartTimeChange = (val: string) => {
    setStartTime(val);
    const newStart = parseDateTimeInputs(startDate, val);
    const newEnd = parseDateTimeInputs(endDate, endTime);
    if (newEnd <= newStart) {
      const adjusted = new Date(newStart.getTime() + 3600000);
      setEndDate(toInputDate(adjusted));
      setEndTime(toInputTime(adjusted));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // All-day events are anchored at noon UTC of the picked day (same as
    // shift adjustments). Local midnight is 23:00Z the day before in BST,
    // which made the server's rota lookup pick the wrong day's watch.
    const start = allDay
      ? new Date(`${startDate}T12:00:00.000Z`)
      : parseDateTimeInputs(startDate, startTime);
    const end = allDay
      ? new Date(`${endDate}T12:00:00.000Z`)
      : parseDateTimeInputs(endDate, endTime);

    onSubmit({
      change_note: moved && changeNote.trim() ? changeNote.trim() : undefined,
      title: title.trim(),
      description: notes,
      location,
      calendar_visibility: calendar,
      event_type: calendar === "watch" ? "watch" : calendar === "personal" ? "personal" : "meeting",
      start_time: start,
      end_time: end,
      all_day: allDay,
      is_watch_event: calendar === "station" || calendar === "watch",
    });
  };

  const selectedCalendar = CALENDAR_OPTIONS.find((c) => c.value === calendar)!;
  const calendarSublabel =
    calendar === "watch" && watchName ? `${watchName} Watch` : selectedCalendar.sublabel;

  // Has the start date moved from what's saved? Then ask why (optional).
  const moved =
    isEditing &&
    !!initialData &&
    toInputDate(new Date(initialData.start_time)) !== startDate;
  const fmtDay = (d: string | Date) =>
    new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  const startDisplayDate = formatDisplayDate(parseDateTimeInputs(startDate, startTime));
  const endDisplayDate = formatDisplayDate(parseDateTimeInputs(endDate, endTime));
  const startDisplayTime = formatDisplayTime(parseDateTimeInputs(startDate, startTime));
  const endDisplayTime = formatDisplayTime(parseDateTimeInputs(endDate, endTime));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col bg-card rounded-2xl shadow-2xl overflow-hidden w-full max-w-md">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New Event"
          className="flex-1 text-xl font-semibold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 mr-2"
          required
        />
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full w-6 h-6 flex items-center justify-center bg-muted hover:bg-muted/80 transition-colors"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Divider */}
      <div className="h-px bg-border/60 mx-4 mb-1" />

      {/* Struck through — the line through it on the paper calendar */}
      {cancelled && (
        <div className="mx-4 my-2 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs">
          <p className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-1.5">
            <Ban className="h-3.5 w-3.5" /> Cancelled
            {initialData?.cancelled_by_name ? ` by ${initialData.cancelled_by_name}` : ""}
            {initialData?.cancelled_at ? ` · ${fmtDay(initialData.cancelled_at)}` : ""}
          </p>
          {initialData?.cancel_reason && (
            <p className="mt-0.5 text-foreground">{initialData.cancel_reason}</p>
          )}
          {onReinstate && (
            <button
              type="button"
              onClick={onReinstate}
              className="mt-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              Reinstate event
            </button>
          )}
        </div>
      )}

      {/* Rescheduled — where it was first due and why */}
      {isEditing && initialData?.rescheduled_from && (
        <div className="mx-4 my-2 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs">
          <p className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" /> Moved from {fmtDay(initialData.rescheduled_from)}
            {initialData.changed_by_name ? ` by ${initialData.changed_by_name}` : ""}
          </p>
          {initialData.change_note && <p className="mt-0.5 text-foreground">{initialData.change_note}</p>}
        </div>
      )}

      {/* Date / Time */}
      <FormRow>
        <div className="space-y-2">
          {/* All-day toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">All-day</span>
            <button
              type="button"
              role="switch"
              aria-checked={allDay}
              onClick={() => setAllDay((v) => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                allDay ? "bg-red-500" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  allDay ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Starts */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground w-12">Starts</span>
            <div className="flex-1 flex items-center gap-1 justify-end flex-wrap">
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="text-sm bg-muted/40 rounded-md px-2 py-1 border-none outline-none text-foreground cursor-pointer hover:bg-muted transition-colors"
              />
              {!allDay && (
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  className="text-sm bg-muted/40 rounded-md px-2 py-1 border-none outline-none text-foreground cursor-pointer hover:bg-muted transition-colors"
                />
              )}
            </div>
          </div>

          {moved && (
            <input
              type="text"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder="Reason for moving it (shown on the event)"
              aria-label="Reason for moving the event"
              className="w-full text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-md px-2 py-1.5 outline-none text-foreground placeholder:text-muted-foreground/70"
            />
          )}

          {/* Ends */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground w-12">Ends</span>
            <div className="flex-1 flex items-center gap-1 justify-end flex-wrap">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-sm bg-muted/40 rounded-md px-2 py-1 border-none outline-none text-foreground cursor-pointer hover:bg-muted transition-colors"
              />
              {!allDay && (
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="text-sm bg-muted/40 rounded-md px-2 py-1 border-none outline-none text-foreground cursor-pointer hover:bg-muted transition-colors"
                />
              )}
            </div>
          </div>
        </div>
      </FormRow>

      {/* Calendar picker */}
      <FormRow icon={Calendar}>
        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-2 w-full text-left hover:bg-muted/30 rounded-lg transition-colors py-0.5"
            onClick={() => setShowCalendarPicker((v) => !v)}
          >
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: selectedCalendar.color }}
            />
            <div>
              <div className="text-sm font-medium text-foreground">{selectedCalendar.label}</div>
              <div className="text-xs text-muted-foreground">{calendarSublabel}</div>
            </div>
            <span className="ml-auto text-muted-foreground text-xs">▾</span>
          </button>

          {showCalendarPicker && (
            <div className="absolute left-0 top-full mt-1 w-72 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden">
              {CALENDAR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-muted/40 transition-colors ${
                    calendar === opt.value ? "bg-muted/60" : ""
                  }`}
                  onClick={() => {
                    setCalendar(opt.value);
                    setShowCalendarPicker(false);
                  }}
                >
                  <div
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: opt.color }}
                  />
                  <div>
                    <div className="text-sm font-medium text-foreground">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {opt.value === "watch" && watchName ? `${watchName} Watch` : opt.sublabel}
                    </div>
                  </div>
                  {calendar === opt.value && (
                    <span className="ml-auto text-red-500 text-sm">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </FormRow>

      {/* Location */}
      <FormRow icon={MapPin}>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Add location or video call"
          className="w-full text-sm bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/60"
        />
      </FormRow>

      {/* Notes */}
      <FormRow icon={FileText}>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes"
          rows={3}
          className="w-full text-sm bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/60 resize-none"
        />
      </FormRow>

      {/* Strike through with a reason */}
      {striking && (
        <div className="mx-4 mb-3 space-y-2">
          <textarea
            value={strikeReason}
            onChange={(e) => setStrikeReason(e.target.value)}
            placeholder="Why is it cancelled? (shown on the event)"
            aria-label="Reason for cancelling"
            rows={2}
            autoFocus
            className="w-full text-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-md px-2 py-1.5 outline-none text-foreground resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => { setStriking(false); setStrikeReason(""); }}>
              Back
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!strikeReason.trim()}
              onClick={() => onStrike?.(strikeReason.trim())}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Strike through
            </Button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/20 border-t border-border/40 gap-2">
        <div className="flex items-center gap-3">
          {canStrike && !cancelled && !striking && (
            <button
              type="button"
              onClick={() => setStriking(true)}
              className="text-sm text-amber-600 hover:text-amber-700 transition-colors"
            >
              Cancel event…
            </button>
          )}
          {isEditing && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="text-sm text-red-500 hover:text-red-600 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Close
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={!title.trim()}
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            {isEditing ? "Save" : "Add Event"}
          </Button>
        </div>
      </div>
    </form>
  );
}
