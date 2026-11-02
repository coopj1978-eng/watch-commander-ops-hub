import { ArrowRight, Ban, FileText, Lock, MapPin, Pencil, X } from "lucide-react";
import type { CalendarEvent } from "~backend/calendar/types";
import type { Task } from "~backend/task/types";
import type { Inspection } from "~backend/inspection/types";
import { calKey, type CalendarItem } from "./CalendarWidget";

// Click something on the calendar and this card says what it is first
// (Nov 2026) — when, where, which calendar, why it was cancelled or moved —
// with Edit there if you want it. Tasks and inspections, which can't be
// changed here, finally do something when tapped: the card, and a way to
// the task board.

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dayLabel = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

function whenText(item: CalendarItem): string {
  const s = item.startTime, e = item.endTime;
  if (item.allDay) {
    const lastDay = new Date(e.getTime() - 1);
    return sameDay(s, lastDay) || e <= s ? `${dayLabel(s)} · All day` : `${dayLabel(s)} – ${dayLabel(lastDay)} · All day`;
  }
  return sameDay(s, e) ? `${dayLabel(s)} · ${hhmm(s)}–${hhmm(e)}` : `${dayLabel(s)} ${hhmm(s)} – ${dayLabel(e)} ${hhmm(e)}`;
}

const STATUS: Record<string, string> = { NotStarted: "To do", InProgress: "In progress", Blocked: "Blocked", Done: "Done", Missed: "Missed" };

export interface PeekAction {
  label: string;
  onClick: () => void;
  icon?: "edit" | "open";
}

export default function CalendarEventPeek({
  item, watchName, style, onClose, primary,
}: {
  item: CalendarItem;
  /** The watch calendar shown, for the label. */
  watchName: string;
  style: React.CSSProperties;
  onClose: () => void;
  primary?: PeekAction;
}) {
  const k = calKey(item);
  const ev = item.type === "event" || item.type === "training" ? (item.data as CalendarEvent) : null;
  const task = item.type === "task" ? (item.data as Task) : null;
  const insp = item.type === "inspection" ? (item.data as Inspection) : null;

  const calendarName =
    task ? "Task · on the shift board" :
    insp ? "Inspection" :
    ev?.event_type === "reminder" ? "Private reminder · only you" :
    k === "station" ? "Springburn Station · everyone" :
    k === "watch" ? `${ev?.watch || watchName} Watch` :
    k === "training" ? `Training · ${ev?.calendar_visibility === "station" ? "station" : `${ev?.watch || watchName} Watch`}` :
    "Personal · only you";

  const title = task ? item.title.replace(/^Task: /, "") : item.title;
  const notes = ev?.description || task?.description || insp?.notes;
  const row: React.CSSProperties = { display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, color: "var(--cal-ink-2)" };

  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ ...style, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ width: 12, height: 12, borderRadius: 4, marginTop: 6, flex: "none", background: `var(--cal-${k}-dot)` }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 11.5, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--cal-muted)" }}>
            {calendarName}
          </p>
          <h2
            style={{
              margin: "4px 0 0", fontSize: 19, lineHeight: 1.25, fontWeight: 650, letterSpacing: "-.01em", wordBreak: "break-word",
              ...(ev?.cancelled_at ? { textDecoration: "line-through", color: "var(--cal-muted)" } : {}),
            }}
          >
            {title}
          </h2>
          <p className="cal-mono" style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--cal-ink-2)" }}>{whenText(item)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="cal-btn"
          style={{ width: 36, height: 36, padding: 0, borderRadius: 10, flex: "none", border: "none", background: "var(--cal-surface-2)" }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {ev?.cancelled_at && (
        <div style={{ borderRadius: 12, padding: "10px 12px", fontSize: 12.5, background: "var(--cal-danger-bg)", color: "var(--cal-danger-fg)" }}>
          <p style={{ margin: 0, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <Ban className="h-3.5 w-3.5" /> Cancelled{ev.cancelled_by_name ? ` by ${ev.cancelled_by_name}` : ""}
          </p>
          {ev.cancel_reason && <p style={{ margin: "4px 0 0" }}>{ev.cancel_reason}</p>}
        </div>
      )}
      {ev?.rescheduled_from && !ev.cancelled_at && (
        <div style={{ ...row, borderRadius: 12, padding: "10px 12px", background: "var(--cal-surface-2)" }}>
          <ArrowRight className="h-4 w-4 shrink-0" style={{ marginTop: 2 }} />
          <span>
            Moved from {dayLabel(new Date(ev.rescheduled_from))}
            {ev.changed_by_name ? ` by ${ev.changed_by_name}` : ""}
            {ev.change_note ? ` — ${ev.change_note}` : ""}
          </span>
        </div>
      )}

      {(ev?.location || insp?.address) && (
        <p style={{ ...row, margin: 0 }}>
          <MapPin className="h-4 w-4 shrink-0" style={{ marginTop: 2 }} />
          <span>{ev?.location || insp?.address}</span>
        </p>
      )}
      {(task || insp) && (
        <p style={{ ...row, margin: 0 }}>
          <Lock className="h-4 w-4 shrink-0" style={{ marginTop: 2 }} />
          <span>
            {task && <>{STATUS[task.status] ?? task.status} · {task.priority} priority{task.watch_unit ? ` · ${task.watch_unit} Watch` : ""}</>}
            {insp && <>{insp.type} · {insp.status}</>}
            <br />
            <span style={{ color: "var(--cal-muted)", fontSize: 12 }}>
              {task ? "Changed on the task board, not here." : "Shown here for planning; read-only."}
            </span>
          </span>
        </p>
      )}
      {notes && (
        <p style={{ ...row, margin: 0, whiteSpace: "pre-wrap" }}>
          <FileText className="h-4 w-4 shrink-0" style={{ marginTop: 2 }} />
          <span style={{ maxHeight: 160, overflowY: "auto" }}>{notes}</span>
        </p>
      )}

      {primary && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 2 }}>
          <button
            type="button"
            onClick={primary.onClick}
            className="cal-focus"
            style={{
              height: 40, padding: "0 16px", borderRadius: 12, border: "none", background: "var(--cal-brand)", color: "#fff",
              font: "inherit", fontSize: 14, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
            }}
          >
            {primary.icon === "open" ? <ArrowRight className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            {primary.label}
          </button>
        </div>
      )}
    </div>
  );
}
