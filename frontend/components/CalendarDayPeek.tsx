import { ChevronRight, X } from "lucide-react";
import type { CalendarEvent } from "~backend/calendar/types";
import { cn } from "@/lib/utils";
import { calKey, myDayText, type CalendarDayOpen, type CalendarItem } from "./CalendarWidget";
import { newItemsFor, type NewKind } from "./CalendarNewMenu";

// Click a day on the calendar and this card shows the day first (John, Nov
// 2026: "bring up all the events on that day and the option to add") —
// everything on it, each opening its own card, then the same choices as the
// "New" button, already set to that day.

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** When it is on this day: "All day", "09:00–11:00", "18:00 →", "until 08:00". */
function whenOn(item: CalendarItem, day: Date): string {
  if (item.allDay) return "All day";
  const starts = sameDay(item.startTime, day), ends = sameDay(item.endTime, day);
  if (starts && ends) return `${hhmm(item.startTime)}–${hhmm(item.endTime)}`;
  if (starts) return `${hhmm(item.startTime)} →`;
  if (ends) return `until ${hhmm(item.endTime)}`;
  return "All day";
}

/** All-day first, then by the clock. */
const dayOrder = (a: CalendarItem, b: CalendarItem) =>
  Number(b.allDay) - Number(a.allDay) || a.startTime.getTime() - b.startTime.getTime() || a.title.localeCompare(b.title);

export default function CalendarDayPeek({
  day, isManager, style, onClose, onOpenItem, onOpenBooking, onAdd,
}: {
  day: CalendarDayOpen;
  isManager: boolean;
  style: React.CSSProperties;
  onClose: () => void;
  onOpenItem: (item: CalendarItem) => void;
  /** Your own booking behind the "You're in / You're off" line, if it has one. */
  onOpenBooking?: () => void;
  onAdd: (kind: NewKind) => void;
}) {
  const { date, shift, note } = day;
  const items = [...day.items].sort(dayOrder);
  const title = date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const shiftText = !shift
    ? null
    : shift.isLeave
    ? "Leave"
    : `${shift.shiftType}${shift.startTime ? ` · ${shift.startTime}–${shift.endTime}` : ""}`;
  const label: React.CSSProperties = {
    margin: 0, fontSize: 11.5, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--cal-muted)",
  };
  const rowBtn: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 44, padding: "6px 8px", border: "none",
    borderRadius: 12, background: "transparent", font: "inherit", color: "var(--cal-ink)", textAlign: "left", cursor: "pointer",
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ ...style, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={label}>{date.toLocaleDateString("en-GB", { weekday: "long" })}</p>
          <h2 style={{ margin: "4px 0 0", fontSize: 19, lineHeight: 1.25, fontWeight: 650, letterSpacing: "-.01em" }}>{title}</h2>
          {shiftText && (
            <p
              className="cal-mono"
              style={{
                margin: "6px 0 0", fontSize: 12.5, color: "var(--cal-ink-2)",
                // Your watch is on, but you're not.
                ...(note?.state === "off" ? { textDecoration: "line-through", opacity: 0.6 } : {}),
              }}
            >
              {shiftText}
            </p>
          )}
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

      {/* ── What's on ── */}
      <div>
        <p style={{ ...label, marginBottom: 4 }}>On this day</p>
        {!note && items.length === 0 && (
          <p style={{ margin: 0, padding: "6px 8px", fontSize: 13.5, color: "var(--cal-muted)" }}>Nothing on this day yet.</p>
        )}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }}>
          {note && (
            <li>
              {onOpenBooking && note.bookingId != null ? (
                <button type="button" onClick={onOpenBooking} className="cal-focus tc-check" style={rowBtn} title="Open the booking to change or delete it">
                  <span style={{ width: 10, height: 10, borderRadius: 3, flex: "none", background: "var(--cal-personal-dot)" }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600 }}>{myDayText(note)}</span>
                  <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--cal-muted)" }} />
                </button>
              ) : (
                <p style={{ ...rowBtn, margin: 0, cursor: "default" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, flex: "none", background: "var(--cal-personal-dot)" }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600 }}>{myDayText(note)}</span>
                </p>
              )}
            </li>
          )}
          {items.map((it) => {
            const cancelled = !!(it.type === "event" || it.type === "training" ? (it.data as CalendarEvent).cancelled_at : null);
            return (
              <li key={`${it.type}-${it.id}`}>
                <button type="button" onClick={() => onOpenItem(it)} className="cal-focus tc-check" style={rowBtn}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, flex: "none", background: `var(--cal-${calKey(it)}-dot)` }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "block", fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        ...(cancelled ? { textDecoration: "line-through", color: "var(--cal-muted)" } : {}),
                      }}
                    >
                      {it.type === "task" ? it.title.replace(/^Task: /, "") : it.title}
                    </span>
                    <span className="cal-mono" style={{ display: "block", fontSize: 11.5, color: "var(--cal-muted)" }}>
                      {whenOn(it, date)}{cancelled ? " · cancelled" : ""}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--cal-muted)" }} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── Add: the same choices as "New", on this day ── */}
      <div style={{ borderTop: "1px solid var(--cal-line)", paddingTop: 12 }}>
        <p style={{ ...label, marginBottom: 4 }}>Add to this day</p>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }}>
          {newItemsFor(isManager).map(({ kind, label: name, hint, Icon, tint }) => (
            <li key={kind}>
              <button type="button" onClick={() => onAdd(kind)} className="cal-focus tc-check" style={rowBtn}>
                <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", tint)}>
                  <Icon className="h-4 w-4" />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>{name}</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--cal-muted)" }}>{hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
