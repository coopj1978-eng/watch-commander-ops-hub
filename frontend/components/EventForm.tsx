import { useState, useEffect, useRef } from "react";
import { X, MapPin, FileText, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CalendarEvent, CalendarVisibility } from "~backend/calendar/types";

interface EventFormProps {
  date: Date;
  initialData?: CalendarEvent;
  defaultCalendar?: CalendarVisibility;
  onSubmit: (data: EventFormData) => void;
  onCancel: () => void;
  onDelete?: () => void;
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
  onSubmit,
  onCancel,
  onDelete,
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

    const start = allDay
      ? (() => { const d = new Date(startDate); d.setHours(0, 0, 0, 0); return d; })()
      : parseDateTimeInputs(startDate, startTime);
    const end = allDay
      ? (() => { const d = new Date(endDate); d.setHours(23, 59, 59, 0); return d; })()
      : parseDateTimeInputs(endDate, endTime);

    onSubmit({
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
              <div className="text-xs text-muted-foreground">{selectedCalendar.sublabel}</div>
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
                    <div className="text-xs text-muted-foreground">{opt.sublabel}</div>
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

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/20 border-t border-border/40 gap-2">
        {isEditing && onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="text-sm text-red-500 hover:text-red-600 transition-colors"
          >
            Delete Event
          </button>
        ) : (
          <div />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
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
