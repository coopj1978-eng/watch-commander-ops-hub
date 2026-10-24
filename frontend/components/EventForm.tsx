import { useState, useEffect, useRef } from "react";
import { X, MapPin, AlignLeft, Ban, CalendarClock } from "lucide-react";
import type { CalendarEvent, CalendarVisibility } from "~backend/calendar/types";

// The add/edit event panel — styled after the Claude Design quick-add
// popover. Uses the .cal-ui tokens, so it must render inside a .cal-ui
// element (WatchCalendar's popover/sheet wrapper).

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
  /** A new event's calendar was picked — remembered for the next new event. */
  onCalendarPick?: (calendar: CalendarVisibility) => void;
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

const CALENDAR_OPTIONS: { value: CalendarVisibility; label: string; key: string }[] = [
  { value: "station", label: "Station", key: "station" },
  { value: "watch", label: "Watch", key: "watch" },
  { value: "personal", label: "Personal", key: "personal" },
];

function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toInputTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function parseDateTimeInputs(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}
const fmtDay = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

const label: React.CSSProperties = { fontSize: 12, color: "var(--cal-muted)" };

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
  onCalendarPick,
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
  const [startDate, setStartDate] = useState(toInputDate(initialData ? new Date(initialData.start_time) : defaultStart));
  const [startTime, setStartTime] = useState(toInputTime(initialData ? new Date(initialData.start_time) : defaultStart));
  const [endDate, setEndDate] = useState(toInputDate(initialData ? new Date(initialData.end_time) : defaultEnd));
  const [endTime, setEndTime] = useState(toInputTime(initialData ? new Date(initialData.end_time) : defaultEnd));
  const [allDay, setAllDay] = useState(initialData?.all_day ?? false);
  const [calendar, setCalendar] = useState<CalendarVisibility>(initialData?.calendar_visibility ?? defaultCalendar);
  const [location, setLocation] = useState(initialData?.location ?? "");
  const [notes, setNotes] = useState(initialData?.description ?? "");
  const [changeNote, setChangeNote] = useState("");
  const [striking, setStriking] = useState(false);
  const [strikeReason, setStrikeReason] = useState("");
  const cancelled = !!initialData?.cancelled_at;
  // Bookings (TOIL / H4H…) are changed from their booking form, not here.
  const canStrike =
    isEditing && !!onStrike && !(initialData as { shift_adjustment_id?: number | null } | undefined)?.shift_adjustment_id;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Keep the end at least an hour after the start when the start moves past it.
  const keepEndAfter = (newStart: Date) => {
    if (parseDateTimeInputs(endDate, endTime) <= newStart) {
      const adjusted = new Date(newStart.getTime() + 3600000);
      setEndDate(toInputDate(adjusted));
      setEndTime(toInputTime(adjusted));
    }
  };

  // Has the start date moved from what's saved? Then ask why (optional).
  const moved = isEditing && !!initialData && toInputDate(new Date(initialData.start_time)) !== startDate;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // All-day events are anchored at noon UTC of the picked day (same as
    // shift adjustments). Local midnight is 23:00Z the day before in BST,
    // which made the server's rota lookup pick the wrong day's watch.
    const start = allDay ? new Date(`${startDate}T12:00:00.000Z`) : parseDateTimeInputs(startDate, startTime);
    const end = allDay ? new Date(`${endDate}T12:00:00.000Z`) : parseDateTimeInputs(endDate, endTime);

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

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 14, padding: 20, color: "var(--cal-ink)" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="cal-mono" style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--cal-muted)" }}>
          {isEditing ? "Edit event" : "New event"}
        </span>
        <button
          type="button"
          aria-label="Close"
          onClick={onCancel}
          className="cal-focus"
          style={{ width: 32, height: 32, borderRadius: 10, border: "none", background: "var(--cal-surface-2)", color: "var(--cal-ink-2)", display: "grid", placeItems: "center", cursor: "pointer" }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <input
        ref={titleRef}
        aria-label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Event title"
        required
        style={{
          font: "inherit", fontSize: 22, fontWeight: 600, color: "var(--cal-ink)", background: "transparent", border: "none",
          borderBottom: "2px solid var(--cal-brand)", padding: "2px 0 8px", outline: "none",
          ...(cancelled ? { textDecoration: "line-through" } : {}),
        }}
      />

      {/* Struck through — the line through it on the paper calendar */}
      {cancelled && (
        <div style={{ borderRadius: 12, background: "var(--cal-station-bg)", color: "var(--cal-station-fg)", padding: "10px 12px", fontSize: 12.5 }}>
          <p style={{ margin: 0, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <Ban className="h-3.5 w-3.5" /> Cancelled
            {initialData?.cancelled_by_name ? ` by ${initialData.cancelled_by_name}` : ""}
            {initialData?.cancelled_at ? ` · ${fmtDay(initialData.cancelled_at)}` : ""}
          </p>
          {initialData?.cancel_reason && <p style={{ margin: "3px 0 0", color: "var(--cal-ink)" }}>{initialData.cancel_reason}</p>}
          {onReinstate && (
            <button
              type="button"
              onClick={onReinstate}
              className="cal-focus"
              style={{ marginTop: 8, height: 32, padding: "0 12px", borderRadius: 10, border: "none", background: "var(--cal-surface)", color: "var(--cal-brand-text)", font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Reinstate event
            </button>
          )}
        </div>
      )}

      {/* Rescheduled — where it was first due and why */}
      {isEditing && initialData?.rescheduled_from && (
        <div style={{ borderRadius: 12, background: "var(--cal-day-bg)", color: "var(--cal-day-fg)", padding: "10px 12px", fontSize: 12.5 }}>
          <p style={{ margin: 0, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <CalendarClock className="h-3.5 w-3.5" /> Moved from {fmtDay(initialData.rescheduled_from)}
            {initialData.changed_by_name ? ` by ${initialData.changed_by_name}` : ""}
          </p>
          {initialData.change_note && <p style={{ margin: "3px 0 0", color: "var(--cal-ink)" }}>{initialData.change_note}</p>}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 13, color: "var(--cal-ink-2)" }}>All-day</span>
        <button
          type="button"
          role="switch"
          aria-checked={allDay}
          aria-label="All-day"
          onClick={() => setAllDay((v) => !v)}
          className="cal-focus"
          style={{ width: 44, height: 26, borderRadius: 999, border: "none", background: allDay ? "var(--cal-brand)" : "var(--cal-surface-3)", position: "relative", cursor: "pointer", padding: 0, transition: "background .15s" }}
        >
          <span style={{ position: "absolute", left: allDay ? 21 : 3, top: 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.25)", transition: "left .15s" }} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: allDay ? "48px minmax(0,1fr)" : "48px minmax(0,1fr) 92px", gap: 8, alignItems: "center" }}>
        <span style={label}>Starts</span>
        <input
          type="date"
          aria-label="Start date"
          value={startDate}
          onChange={(e) => { setStartDate(e.target.value); keepEndAfter(parseDateTimeInputs(e.target.value, startTime)); }}
          className="cal-field"
        />
        {!allDay && (
          <input
            type="time"
            aria-label="Start time"
            value={startTime}
            onChange={(e) => { setStartTime(e.target.value); keepEndAfter(parseDateTimeInputs(startDate, e.target.value)); }}
            className="cal-field cal-mono"
          />
        )}
        <span style={label}>Ends</span>
        <input type="date" aria-label="End date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="cal-field" />
        {!allDay && (
          <input type="time" aria-label="End time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="cal-field cal-mono" />
        )}
      </div>

      {moved && (
        <input
          type="text"
          value={changeNote}
          onChange={(e) => setChangeNote(e.target.value)}
          placeholder="Reason for moving it (shown on the event)"
          aria-label="Reason for moving the event"
          className="cal-field"
          style={{ background: "var(--cal-day-bg)", borderColor: "transparent" }}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={label}>Calendar</span>
        <div role="radiogroup" aria-label="Calendar" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
          {CALENDAR_OPTIONS.map((opt) => {
            const on = calendar === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setCalendar(opt.value);
                  if (!isEditing) onCalendarPick?.(opt.value);
                }}
                className="cal-focus"
                style={{
                  height: 40, borderRadius: 10, font: "inherit", fontSize: 12.5, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 0, padding: "0 6px",
                  ...(on
                    ? { border: `2px solid var(--cal-${opt.key}-dot)`, background: `var(--cal-${opt.key}-bg)`, color: `var(--cal-${opt.key}-fg)`, fontWeight: 600 }
                    : { border: "1px solid var(--cal-line-2)", background: "var(--cal-surface)", color: "var(--cal-ink-2)", fontWeight: 500 }),
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: `var(--cal-${opt.key}-dot)`, flex: "none" }} />
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {opt.value === "watch" && watchName ? `Watch · ${watchName}` : opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 10, height: 40, padding: "0 10px", borderRadius: 10, background: "var(--cal-surface-2)", color: "var(--cal-muted)" }}>
        <MapPin className="h-4 w-4 shrink-0" />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Add location"
          aria-label="Location"
          style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", font: "inherit", fontSize: 13, color: "var(--cal-ink)", outline: "none" }}
        />
      </label>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 10, borderRadius: 10, background: "var(--cal-surface-2)", color: "var(--cal-muted)" }}>
        <AlignLeft className="h-4 w-4 shrink-0" style={{ marginTop: 2 }} />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes"
          aria-label="Notes"
          rows={2}
          style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", font: "inherit", fontSize: 13, color: "var(--cal-ink)", outline: "none", resize: "none" }}
        />
      </label>

      {/* Strike through with a reason */}
      {striking && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea
            value={strikeReason}
            onChange={(e) => setStrikeReason(e.target.value)}
            placeholder="Why is it cancelled? (shown on the event)"
            aria-label="Reason for cancelling"
            rows={2}
            autoFocus
            style={{ font: "inherit", fontSize: 13, borderRadius: 10, padding: 10, border: "1px solid var(--cal-station-dot)", background: "var(--cal-station-bg)", color: "var(--cal-ink)", outline: "none", resize: "none" }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="cal-btn" style={{ height: 36, padding: "0 14px", fontSize: 13 }} onClick={() => { setStriking(false); setStrikeReason(""); }}>
              Back
            </button>
            <button
              type="button"
              disabled={!strikeReason.trim()}
              onClick={() => onStrike?.(strikeReason.trim())}
              className="cal-focus"
              style={{ height: 36, padding: "0 14px", borderRadius: 12, border: "none", background: "var(--cal-station-dot)", color: "#fff", font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: strikeReason.trim() ? 1 : 0.5 }}
            >
              Strike through
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 2, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {canStrike && !cancelled && !striking && (
            <button type="button" onClick={() => setStriking(true)} className="cal-focus" style={{ border: "none", background: "transparent", color: "var(--cal-day-dot)", font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}>
              Cancel event…
            </button>
          )}
          {isEditing && onDelete && (
            <button type="button" onClick={onDelete} className="cal-focus" style={{ border: "none", background: "transparent", color: "var(--cal-station-dot)", font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}>
              Delete
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <button type="button" onClick={onCancel} className="cal-btn" style={{ height: 44, padding: "0 18px", fontSize: 14 }}>
            Close
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className="cal-focus"
            style={{ height: 44, padding: "0 20px", borderRadius: 12, border: "none", background: "var(--cal-brand)", color: "#fff", font: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: title.trim() ? 1 : 0.5 }}
          >
            {isEditing ? "Save" : "Add Event"}
          </button>
        </div>
      </div>
    </form>
  );
}
