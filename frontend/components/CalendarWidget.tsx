import { useRef, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, FileText, ArrowRight, Plus } from "lucide-react";
import type { CalendarEvent } from "~backend/calendar/types";
import type { Task } from "~backend/task/types";
import type { Inspection } from "~backend/inspection/types";
import type { ShiftDay } from "@/lib/shiftRota";
import { getShiftForDate } from "@/lib/shiftRota";

// Calendar views — redesigned from the Claude Design week view (Oct 2026).
// Colours come from the .cal-ui tokens in index.css (light + dark).

export type CalendarViewType = "day" | "week" | "month" | "year";

export interface CalendarItem {
  id: number;
  title: string;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  type: "event" | "task" | "inspection" | "training";
  calendarType: "station" | "watch" | "personal" | "other";
  data: CalendarEvent | Task | Inspection;
}

/** Where the user clicked — the event form opens beside it on desktop. */
export interface CalendarAnchor {
  x: number;
  y: number;
}

interface CalendarWidgetProps {
  events?: CalendarEvent[];
  tasks?: Task[];
  inspections?: Inspection[];
  shiftSchedule?: ShiftDay[];
  /** When provided, shifts are computed per-day directly from the rota engine
   *  (more robust than filtering a pre-built schedule array that can go out of
   *  sync with the displayed range). */
  userWatch?: string;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  view: CalendarViewType;
  onViewChange: (view: CalendarViewType) => void;
  onSlotClick?: (date: Date, anchor?: CalendarAnchor) => void;
  onEventClick?: (item: CalendarItem, anchor?: CalendarAnchor) => void;
  /** A new event being added — shown as a dashed placeholder in Day/Week. */
  pendingSlot?: Date | null;
}

// ─── Colours ──────────────────────────────────────────────────────────────────
type CalKey = "station" | "watch" | "personal" | "tasks" | "insp" | "training";

function calKey(item: CalendarItem): CalKey {
  if (item.type === "task") return "tasks";
  if (item.type === "inspection") return "insp";
  if (item.type === "training") return "training";
  if (item.calendarType === "station") return "station";
  if (item.calendarType === "watch") return "watch";
  return "personal";
}
const tok = (k: string, part: "bg" | "fg" | "dot" | "shade") => `var(--cal-${k}-${part})`;

function eventData(item: CalendarItem): CalendarEvent | null {
  return item.type === "event" || item.type === "training" ? (item.data as CalendarEvent) : null;
}
/** Tasks and inspections show on the calendar but are changed elsewhere. */
const isReadOnly = (item: CalendarItem) => item.type === "task" || item.type === "inspection";
/** Private reminders from Notes (only the writer sees them). */
const isPrivate = (item: CalendarItem) => eventData(item)?.event_type === "reminder";

/** Hover text: what it is, plus why it was cancelled or moved. */
function itemTooltip(item: CalendarItem): string {
  const ev = eventData(item);
  const parts = [item.title];
  if (ev?.cancelled_at) parts.push(`Cancelled${ev.cancelled_by_name ? ` by ${ev.cancelled_by_name}` : ""}${ev.cancel_reason ? ` — ${ev.cancel_reason}` : ""}`);
  if (ev?.rescheduled_from) parts.push(`Moved${ev.change_note ? ` — ${ev.change_note}` : ""}`);
  if (isReadOnly(item)) parts.push("Read-only here");
  if (isPrivate(item)) parts.push("Private reminder from Notes");
  return parts.join("\n");
}

// ─── Shifts ───────────────────────────────────────────────────────────────────
type ShiftKind = "day" | "night" | "leave";

function getShiftsForDay(shiftSchedule: ShiftDay[], date: Date, userWatch?: string): ShiftDay[] {
  // With a watch, compute straight from the rota — a pre-built array can drift
  // out of the displayed range.
  if (userWatch) {
    const shift = getShiftForDate(userWatch, date);
    if (shift && shift.shiftType !== "Rest") return [shift];
    return [];
  }
  const dateStr = isoDate(date);
  return shiftSchedule.filter((s) => s.date === dateStr);
}

function shiftKind(s?: ShiftDay): ShiftKind | null {
  if (!s) return null;
  if (s.isLeave) return "leave";
  if (s.shiftType.includes("Night")) return "night";
  if (s.shiftType.includes("Day")) return "day";
  return null;
}
const shiftLabel = (s?: ShiftDay) => (!s ? "Rest" : s.isLeave ? "Leave" : s.shiftType);

function ShiftChip({ shift, onBrand }: { shift?: ShiftDay; onBrand?: boolean }) {
  const k = shiftKind(shift);
  return (
    <span
      className="whitespace-nowrap"
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 8px",
        borderRadius: 999,
        minHeight: 14,
        ...(onBrand
          ? { background: "rgba(255,255,255,.2)", color: "#fff" }
          : k
          ? { background: tok(k, "bg"), color: tok(k, "fg") }
          : { background: "transparent", color: "var(--cal-muted)" }),
      }}
    >
      {shiftLabel(shift)}
    </span>
  );
}

// ─── Constants & dates ────────────────────────────────────────────────────────
const HOUR_PX = 48;
const DAY_PX = HOUR_PX * 24;
const TIME_COL = 56;
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
/** True if an event (single or multi-day) covers the given calendar day. */
function spansDay(item: CalendarItem, day: Date): boolean {
  const start = startOfDay(item.startTime);
  const end = new Date(item.endTime);
  end.setHours(23, 59, 59, 999);
  const d = new Date(day);
  d.setHours(12, 0, 0, 0);
  return d >= start && d <= end;
}
// Monday-first week
function getWeekDays(date: Date): Date[] {
  const day = date.getDay();
  const monday = addDays(startOfDay(date), day === 0 ? -6 : 1 - day);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
function getDaysInMonthGrid(date: Date): (Date | null)[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = (new Date(year, month, 1).getDay() + 6) % 7;
  const n = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= n; d++) cells.push(new Date(year, month, d));
  return cells;
}

// ─── Map data → CalendarItem ─────────────────────────────────────────────────
function buildItems(events: CalendarEvent[], tasks: Task[], inspections: Inspection[]): CalendarItem[] {
  const items: CalendarItem[] = [];
  events.forEach((e) => {
    const calType = e.calendar_visibility ?? (e.is_watch_event ? "station" : "personal");
    items.push({
      id: e.id,
      title: e.title,
      startTime: new Date(e.start_time),
      endTime: new Date(e.end_time),
      allDay: e.all_day,
      type: e.event_type === "training" ? "training" : "event",
      calendarType: calType as CalendarItem["calendarType"],
      data: e,
    });
  });
  tasks.forEach((t) => {
    if (!t.due_at) return;
    const due = new Date(t.due_at);
    items.push({
      id: t.id, title: `Task: ${t.title}`, startTime: due, endTime: new Date(due.getTime() + 3600000),
      allDay: false, type: "task", calendarType: "other", data: t,
    });
  });
  inspections.forEach((ins) => {
    const start = new Date(ins.scheduled_for);
    items.push({
      id: ins.id, title: `${ins.type} · ${ins.address}`, startTime: start, endTime: new Date(start.getTime() + 7200000),
      allDay: false, type: "inspection", calendarType: "other", data: ins,
    });
  });
  return items;
}

const anchorOf = (e: React.MouseEvent): CalendarAnchor => ({ x: e.clientX, y: e.clientY });

// ─── Small pieces ─────────────────────────────────────────────────────────────
function Dot({ k, size = 7 }: { k: string; size?: number }) {
  return <span style={{ width: size, height: size, borderRadius: "50%", background: tok(k, "dot"), flex: "none" }} />;
}

function ItemIcons({ item }: { item: CalendarItem }) {
  if (isReadOnly(item)) return <Lock className="h-3 w-3 shrink-0 ml-auto" aria-label="Read-only" />;
  if (isPrivate(item)) return <FileText className="h-3 w-3 shrink-0 ml-auto" aria-label="Private reminder from Notes" />;
  return null;
}

/** "Cancelled" / "Moved" badges — the reason shows on hover or when opened. */
function StateBadges({ item }: { item: CalendarItem }) {
  const ev = eventData(item);
  if (!ev?.cancelled_at && !ev?.rescheduled_from) return null;
  const badge: React.CSSProperties = {
    alignSelf: "flex-start", marginTop: 2, fontSize: 10.5, fontWeight: 600, padding: "2px 7px",
    borderRadius: 999, background: "var(--cal-surface)", color: "var(--cal-ink-2)",
    display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none",
  };
  return ev.cancelled_at ? (
    <span style={badge}>Cancelled</span>
  ) : (
    <span style={badge}><ArrowRight className="h-2.5 w-2.5" />Moved</span>
  );
}

function titleStyle(item: CalendarItem): React.CSSProperties {
  return {
    fontSize: 12.5, fontWeight: 600, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden",
    textOverflow: "ellipsis", minWidth: 0,
    ...(eventData(item)?.cancelled_at ? { textDecoration: "line-through" } : {}),
  };
}

function blockBg(item: CalendarItem): string {
  const k = calKey(item);
  return eventData(item)?.cancelled_at
    ? `repeating-linear-gradient(135deg, ${tok(k, "bg")} 0 7px, var(--cal-surface-2) 7px 11px)`
    : tok(k, "bg");
}

/** A pill used in all-day lanes, month cells and the phone agenda. */
function EventPill({
  item, onClick, showTime, extra, style,
}: {
  item: CalendarItem;
  onClick?: (e: React.MouseEvent) => void;
  showTime?: boolean;
  extra?: string;
  style?: React.CSSProperties;
}) {
  const k = calKey(item);
  return (
    <button
      type="button"
      data-event
      title={itemTooltip(item)}
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
      className="cal-focus"
      style={{
        height: 26, borderRadius: 8, border: "none", background: blockBg(item), color: tok(k, "fg"),
        font: "inherit", fontSize: 12, fontWeight: 600, textAlign: "left", padding: "0 8px",
        display: "flex", alignItems: "center", gap: 6, cursor: isReadOnly(item) ? "default" : "pointer",
        minWidth: 0, width: "100%", ...style,
      }}
    >
      <Dot k={k} />
      {showTime && !item.allDay && (
        <span className="cal-mono" style={{ fontWeight: 400, fontSize: 11, opacity: 0.85 }}>{hhmm(item.startTime)}</span>
      )}
      <span style={{ ...titleStyle(item), fontSize: 12 }}>{item.title}</span>
      {extra && <span className="cal-mono" style={{ fontWeight: 400, opacity: 0.8, marginLeft: "auto", fontSize: 11 }}>{extra}</span>}
      {!extra && <ItemIcons item={item} />}
    </button>
  );
}

// ─── Time grid (Day + Week) ───────────────────────────────────────────────────
interface Placed { item: CalendarItem; top: number; height: number; lane: number; lanes: number; }

/** Timed events on a day, clipped to the day and laid side by side when they overlap. */
function layoutDay(items: CalendarItem[], day: Date): Placed[] {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = dayStart + 86400000;
  const timed = items
    .filter((it) => !it.allDay && it.startTime.getTime() < dayEnd && Math.max(it.endTime.getTime(), it.startTime.getTime() + 1) > dayStart)
    .map((it) => {
      const s = Math.max(it.startTime.getTime(), dayStart);
      const e = Math.min(Math.max(it.endTime.getTime(), it.startTime.getTime() + 30 * 60000), dayEnd);
      return { item: it, s, e };
    })
    .sort((a, b) => a.s - b.s || b.e - a.e);

  const placed: Placed[] = [];
  let group: { p: Placed; e: number }[] = [];
  let groupEnd = -Infinity;
  const colEnds: number[] = [];
  const flush = () => {
    const lanes = Math.max(1, colEnds.length);
    group.forEach((g) => (g.p.lanes = lanes));
    group = [];
    colEnds.length = 0;
  };
  for (const t of timed) {
    if (t.s >= groupEnd) { flush(); groupEnd = -Infinity; }
    let lane = colEnds.findIndex((end) => end <= t.s);
    if (lane === -1) { lane = colEnds.length; colEnds.push(t.e); } else colEnds[lane] = t.e;
    const p: Placed = {
      item: t.item,
      top: ((t.s - dayStart) / 3600000) * HOUR_PX,
      height: Math.max(((t.e - t.s) / 3600000) * HOUR_PX, 22),
      lane,
      lanes: 1,
    };
    group.push({ p, e: t.e });
    placed.push(p);
    groupEnd = Math.max(groupEnd, t.e);
  }
  flush();
  return placed;
}

function EventBlock({ placed, onClick }: { placed: Placed; onClick: (e: React.MouseEvent) => void }) {
  const { item, top, height, lane, lanes } = placed;
  const k = calKey(item);
  const compact = height < 40;
  const ev = eventData(item);
  return (
    <button
      type="button"
      data-event
      title={itemTooltip(item)}
      aria-label={`${item.title}, ${hhmm(item.startTime)} to ${hhmm(item.endTime)}${ev?.cancelled_at ? ", cancelled" : ""}${ev?.rescheduled_from ? ", moved" : ""}`}
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      className="cal-focus"
      style={{
        position: "absolute",
        top: top + 1,
        height: height - 2,
        left: `calc(${(lane / lanes) * 100}% + 3px)`,
        width: `calc(${100 / lanes}% - 6px)`,
        borderRadius: 10, border: "none", background: blockBg(item), color: tok(k, "fg"),
        font: "inherit", textAlign: "left", padding: compact ? "3px 8px" : "7px 9px",
        display: "flex", flexDirection: compact ? "row" : "column", alignItems: compact ? "center" : "stretch",
        gap: compact ? 8 : 2, overflow: "hidden", cursor: isReadOnly(item) ? "default" : "pointer",
        boxSizing: "border-box", zIndex: 1,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, width: compact ? "auto" : "100%", flex: compact ? "1 1 auto" : undefined }}>
        <Dot k={k} />
        <span style={titleStyle(item)}>{item.title}</span>
        {!compact && <ItemIcons item={item} />}
      </span>
      <span className="cal-mono" style={{ fontSize: 11, opacity: 0.85, whiteSpace: "nowrap" }}>
        {hhmm(item.startTime)}{compact ? "" : ` – ${hhmm(item.endTime)}`}
      </span>
      {!compact && height >= 64 && <StateBadges item={item} />}
    </button>
  );
}

function HourLabels() {
  return (
    <div style={{ position: "relative", height: DAY_PX }}>
      {Array.from({ length: 24 }, (_, h) =>
        h === 0 ? null : (
          <span
            key={h}
            className="cal-mono"
            style={{ position: "absolute", right: 8, top: h * HOUR_PX - 7, fontSize: 11, color: "var(--cal-muted)" }}
          >
            {pad(h)}:00
          </span>
        )
      )}
    </div>
  );
}

/** One day's column: hour lines, shift shading, events, now line, pending slot. */
function DayColumn({
  day, items, shiftSchedule, userWatch, pendingSlot, onSlotClick, onEventClick,
}: {
  day: Date;
  items: CalendarItem[];
  shiftSchedule: ShiftDay[];
  userWatch?: string;
  pendingSlot?: Date | null;
  onSlotClick?: (date: Date, anchor?: CalendarAnchor) => void;
  onEventClick?: (item: CalendarItem, anchor?: CalendarAnchor) => void;
}) {
  const today = new Date();
  const isToday = sameDay(day, today);
  const kind = shiftKind(getShiftsForDay(shiftSchedule, day, userWatch)[0]);
  const prevNight = shiftKind(getShiftsForDay(shiftSchedule, addDays(day, -1), userWatch)[0]) === "night";
  const shades: { k: ShiftKind; from: number; to: number }[] = [];
  if (prevNight) shades.push({ k: "night", from: 0, to: 8 });
  if (kind === "day") shades.push({ k: "day", from: 8, to: 18 });
  if (kind === "night") shades.push({ k: "night", from: 18, to: 24 });
  if (kind === "leave") shades.push({ k: "leave", from: 0, to: 24 });

  const placed = layoutDay(items, day);
  const nowTop = (today.getHours() + today.getMinutes() / 60) * HOUR_PX;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-event]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = Math.round((((e.clientY - rect.top) / HOUR_PX) * 60) / 30) * 30;
    const at = new Date(day);
    at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    onSlotClick?.(at, anchorOf(e));
  };

  return (
    <div
      onClick={handleClick}
      style={{
        position: "relative", height: DAY_PX, borderRadius: 12, cursor: "pointer",
        backgroundImage: "repeating-linear-gradient(to bottom, var(--cal-line) 0 1px, transparent 1px 48px)",
      }}
    >
      {shades.map((s, i) => (
        <div
          key={i}
          aria-hidden
          style={{
            position: "absolute", left: 0, right: 0, top: s.from * HOUR_PX, height: (s.to - s.from) * HOUR_PX,
            background: tok(s.k, "shade"), borderRadius: 8,
          }}
        />
      ))}
      {placed.map((p) => (
        <EventBlock key={`${p.item.type}-${p.item.id}`} placed={p} onClick={(e) => onEventClick?.(p.item, anchorOf(e))} />
      ))}
      {isToday && (
        <div aria-hidden style={{ position: "absolute", left: -4, right: 0, top: nowTop, height: 2, background: "var(--cal-now)", zIndex: 3 }}>
          <span style={{ position: "absolute", left: -4, top: -4, width: 10, height: 10, borderRadius: "50%", background: "var(--cal-now)" }} />
        </div>
      )}
      {pendingSlot && sameDay(pendingSlot, day) && (
        <div
          style={{
            position: "absolute", left: 4, right: 4,
            top: (pendingSlot.getHours() + pendingSlot.getMinutes() / 60) * HOUR_PX, height: HOUR_PX - 2,
            borderRadius: 10, border: "2px dashed var(--cal-brand)", background: "var(--cal-brand-soft)",
            color: "var(--cal-brand-text)", boxSizing: "border-box", padding: "6px 8px", zIndex: 2,
            display: "flex", flexDirection: "column", gap: 2, pointerEvents: "none",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600 }}>New event</span>
          <span className="cal-mono" style={{ fontSize: 11 }}>{hhmm(pendingSlot)} – {hhmm(new Date(pendingSlot.getTime() + 3600000))}</span>
        </div>
      )}
    </div>
  );
}

/** Week strip tile (and the Day view's single tile). */
function DayTile({ day, shift, showShift, onClick }: { day: Date; shift?: ShiftDay; showShift: boolean; onClick?: () => void }) {
  const today = sameDay(day, new Date());
  const name = DOW[(day.getDay() + 6) % 7];
  return (
    <button
      type="button"
      onClick={onClick}
      className="cal-focus"
      aria-label={`${name} ${day.getDate()} ${MONTH_NAMES[day.getMonth()]}${showShift ? `, ${shift ? shiftLabel(shift) : "rest day"}` : ""}${today ? ", today" : ""}`}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 6px 10px",
        borderRadius: 16, border: "none", font: "inherit", cursor: "pointer", minWidth: 0,
        ...(today
          ? { background: "var(--cal-brand)", color: "#fff", boxShadow: "0 8px 20px rgba(67,56,202,.35)" }
          : { background: "var(--cal-surface-2)", color: "var(--cal-ink)" }),
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.85 }}>{name}</span>
      <span className="cal-mono" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1 }}>{day.getDate()}</span>
      {showShift ? <ShiftChip shift={shift} onBrand={today} /> : <span style={{ height: 20 }} />}
    </button>
  );
}

/** All-day events across the visible days, stacked in lanes. */
function AllDayLane({
  days, items, onEventClick,
}: {
  days: Date[];
  items: CalendarItem[];
  onEventClick?: (item: CalendarItem, anchor?: CalendarAnchor) => void;
}) {
  const first = startOfDay(days[0]).getTime();
  const last = startOfDay(days[days.length - 1]).getTime();
  const idx = (d: Date) => Math.round((startOfDay(d).getTime() - first) / 86400000);
  const rows: number[][] = []; // per lane: occupied column indexes
  const placed = items
    .filter((it) => it.allDay && startOfDay(it.startTime).getTime() <= last && startOfDay(it.endTime).getTime() >= first)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    .map((it) => {
      const c0 = Math.max(0, idx(it.startTime));
      const c1 = Math.min(days.length - 1, idx(it.endTime));
      let lane = rows.findIndex((cols) => cols.every((c) => c < c0 || c > c1));
      if (lane === -1) { lane = rows.length; rows.push([]); }
      for (let c = c0; c <= c1; c++) rows[lane].push(c);
      const span = c1 - c0 + 1;
      const extra = span > 1 ? `${DOW[(days[c0].getDay() + 6) % 7]}–${DOW[(days[c1].getDay() + 6) % 7]}` : undefined;
      return { it, c0, span, lane, extra };
    });
  if (placed.length === 0) return null;
  return (
    <div
      style={{
        display: "grid", gridTemplateColumns: `${TIME_COL}px repeat(${days.length}, minmax(0, 1fr))`,
        columnGap: 8, rowGap: 4, marginTop: 12, padding: "8px 0", borderTop: "1px solid var(--cal-line)",
        borderBottom: "1px solid var(--cal-line)", alignItems: "center",
      }}
    >
      <span style={{ gridColumn: 1, gridRow: `1 / span ${rows.length}`, fontSize: 11, color: "var(--cal-muted)", textAlign: "right", paddingRight: 4 }}>
        All-day
      </span>
      {placed.map(({ it, c0, span, lane, extra }) => (
        <EventPill
          key={`${it.type}-${it.id}`}
          item={it}
          extra={extra}
          onClick={(e) => onEventClick?.(it, anchorOf(e))}
          style={{ gridColumn: `${c0 + 2} / span ${span}`, gridRow: lane + 1, height: 28 }}
        />
      ))}
    </div>
  );
}

function TimeGridCard({
  days, items, shiftSchedule, userWatch, scrollRef, pendingSlot, onSlotClick, onEventClick, onDayClick,
}: {
  days: Date[];
  items: CalendarItem[];
  shiftSchedule: ShiftDay[];
  userWatch?: string;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  pendingSlot?: Date | null;
  onSlotClick?: (date: Date, anchor?: CalendarAnchor) => void;
  onEventClick?: (item: CalendarItem, anchor?: CalendarAnchor) => void;
  onDayClick?: (date: Date) => void;
}) {
  const showShift = !!userWatch || shiftSchedule.length > 0;
  const cols = `${TIME_COL}px repeat(${days.length}, minmax(0, 1fr))`;
  return (
    <section className="cal-card" style={{ borderRadius: 24, overflowX: "auto" }}>
      <div style={{ minWidth: days.length > 1 ? 820 : 0, padding: "12px 12px 16px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: cols, gap: "0 8px" }}>
          <span />
          {days.map((d) => (
            <DayTile
              key={d.toISOString()}
              day={d}
              shift={getShiftsForDay(shiftSchedule, d, userWatch)[0]}
              showShift={showShift}
              onClick={days.length > 1 ? () => onDayClick?.(d) : undefined}
            />
          ))}
        </div>
        <AllDayLane days={days} items={items} onEventClick={onEventClick} />
        <div
          ref={scrollRef}
          style={{ marginTop: 4, overflowY: "auto", height: "clamp(440px, calc(100vh - 360px), 900px)" }}
        >
          <div style={{ display: "grid", gridTemplateColumns: cols, columnGap: 8 }}>
            <HourLabels />
            {days.map((d) => (
              <DayColumn
                key={d.toISOString()}
                day={d}
                items={items}
                shiftSchedule={shiftSchedule}
                userWatch={userWatch}
                pendingSlot={pendingSlot}
                onSlotClick={onSlotClick}
                onEventClick={onEventClick}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Month ────────────────────────────────────────────────────────────────────
function MonthView({
  date, items, shiftSchedule, userWatch, onSlotClick, onEventClick, onDayNavigate,
}: {
  date: Date;
  items: CalendarItem[];
  shiftSchedule: ShiftDay[];
  userWatch?: string;
  onSlotClick?: (date: Date, anchor?: CalendarAnchor) => void;
  onEventClick?: (item: CalendarItem, anchor?: CalendarAnchor) => void;
  onDayNavigate?: (date: Date) => void;
}) {
  const today = new Date();
  const cells = getDaysInMonthGrid(date);
  return (
    <section className="cal-card" style={{ borderRadius: 24, padding: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6, marginBottom: 6 }}>
        {DOW.map((d) => (
          <span key={d} style={{ fontSize: 12, fontWeight: 600, color: "var(--cal-muted)", padding: "2px 8px" }}>{d}</span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`b-${i}`} />;
          const isToday = sameDay(day, today);
          const shift = getShiftsForDay(shiftSchedule, day, userWatch)[0];
          const k = shiftKind(shift);
          const dayItems = items
            .filter((it) => spansDay(it, day))
            .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startTime.getTime() - b.startTime.getTime());
          const visible = dayItems.slice(0, 3);
          const more = dayItems.length - visible.length;
          return (
            <div
              key={day.toISOString()}
              role="button"
              tabIndex={0}
              onClick={(e) => onSlotClick?.(day, anchorOf(e))}
              onKeyDown={(e) => { if (e.key === "Enter") onSlotClick?.(day); }}
              className="cal-focus"
              style={{
                minHeight: 112, borderRadius: 14, padding: 8, cursor: "pointer", display: "flex", flexDirection: "column", gap: 4,
                background: k ? tok(k, "shade") : "var(--cal-surface-2)",
                boxShadow: isToday ? "inset 0 0 0 2px var(--cal-brand)" : undefined,
                minWidth: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                <span
                  className="cal-mono"
                  style={{
                    fontSize: 13, fontWeight: isToday ? 700 : 500, width: 26, height: 26, borderRadius: 8,
                    display: "grid", placeItems: "center",
                    ...(isToday ? { background: "var(--cal-brand)", color: "#fff" } : { color: "var(--cal-ink)" }),
                  }}
                >
                  {day.getDate()}
                </span>
                {k && (
                  <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 6px", borderRadius: 999, background: tok(k, "bg"), color: tok(k, "fg"), whiteSpace: "nowrap" }}>
                    {k === "leave" ? "Leave" : k === "day" ? "Day" : "Night"}
                  </span>
                )}
              </div>
              {visible.map((it) => (
                <EventPill key={`${it.type}-${it.id}`} item={it} showTime onClick={(e) => onEventClick?.(it, anchorOf(e))} style={{ height: 22, fontSize: 11.5 }} />
              ))}
              {more > 0 && (
                <button
                  type="button"
                  data-event
                  onClick={(e) => { e.stopPropagation(); onDayNavigate?.(day); }}
                  className="cal-mono"
                  style={{ border: "none", background: "transparent", color: "var(--cal-muted)", fontSize: 11, textAlign: "left", padding: "0 4px", cursor: "pointer" }}
                >
                  +{more} more
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Year ─────────────────────────────────────────────────────────────────────
function YearView({ year, items, onMonthClick }: { year: number; items: CalendarItem[]; onMonthClick: (d: Date) => void }) {
  const today = new Date();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
      {Array.from({ length: 12 }, (_, mi) => {
        const monthDate = new Date(year, mi, 1);
        const monthItems = items.filter((it) => it.startTime.getFullYear() === year && it.startTime.getMonth() === mi);
        const busy = new Set(monthItems.map((it) => it.startTime.getDate()));
        return (
          <button
            key={mi}
            type="button"
            onClick={() => onMonthClick(monthDate)}
            className="cal-card cal-focus"
            style={{ padding: 16, textAlign: "left", font: "inherit", color: "var(--cal-ink)", cursor: "pointer" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{MONTH_NAMES[mi]}</span>
              <span className="cal-mono" style={{ fontSize: 11, color: "var(--cal-muted)" }}>
                {monthItems.length} event{monthItems.length === 1 ? "" : "s"}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", textAlign: "center", rowGap: 2 }}>
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <span key={i} style={{ fontSize: 10, fontWeight: 600, color: "var(--cal-muted)" }}>{d}</span>
              ))}
              {getDaysInMonthGrid(monthDate).map((day, i) =>
                !day ? <span key={i} /> : (
                  <span key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <span
                      className="cal-mono"
                      style={{
                        fontSize: 11, width: 22, height: 22, borderRadius: 7, display: "grid", placeItems: "center",
                        ...(sameDay(day, today) ? { background: "var(--cal-brand)", color: "#fff", fontWeight: 600 } : {}),
                      }}
                    >
                      {day.getDate()}
                    </span>
                    <span style={{ width: 4, height: 4, borderRadius: "50%", background: busy.has(day.getDate()) ? "var(--cal-brand)" : "transparent" }} />
                  </span>
                )
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Phone: month grid + day agenda ───────────────────────────────────────────
function MobileMonth({
  date, items, shiftSchedule, userWatch, selectedDay, onDaySelect, onPrev, onNext,
}: {
  date: Date;
  items: CalendarItem[];
  shiftSchedule: ShiftDay[];
  userWatch?: string;
  selectedDay: Date;
  onDaySelect: (d: Date) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const today = new Date();
  return (
    <section className="cal-card" style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button type="button" aria-label="Previous month" onClick={onPrev} className="cal-btn" style={{ width: 40, height: 40, padding: 0 }}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{MONTH_NAMES[date.getMonth()]} {date.getFullYear()}</h2>
        <button type="button" aria-label="Next month" onClick={onNext} className="cal-btn" style={{ width: 40, height: 40, padding: 0 }}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", textAlign: "center", rowGap: 4 }}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} style={{ fontSize: 11, fontWeight: 600, color: "var(--cal-muted)", padding: "2px 0" }}>{d}</span>
        ))}
        {getDaysInMonthGrid(date).map((day, i) => {
          if (!day) return <span key={i} />;
          const isToday = sameDay(day, today);
          const selected = sameDay(day, selectedDay);
          const k = shiftKind(getShiftsForDay(shiftSchedule, day, userWatch)[0]);
          const dots = Array.from(new Set(items.filter((it) => spansDay(it, day)).map((it) => calKey(it)))).slice(0, 3);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDaySelect(day)}
              className="cal-focus"
              aria-label={`${day.getDate()} ${MONTH_NAMES[day.getMonth()]}${k ? `, ${k} shift` : ""}${dots.length ? `, ${dots.length} calendar${dots.length > 1 ? "s" : ""} with events` : ""}`}
              style={{
                height: 50, border: "none", borderRadius: 12, padding: 0, cursor: "pointer", font: "inherit",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                background: selected ? "var(--cal-brand)" : "transparent",
                color: selected ? "#fff" : isToday ? "var(--cal-brand)" : "var(--cal-ink)",
                boxShadow: isToday && !selected ? "inset 0 0 0 2px var(--cal-brand)" : undefined,
              }}
            >
              <span className="cal-mono" style={{ fontSize: 14, fontWeight: isToday || selected ? 700 : 500 }}>{day.getDate()}</span>
              <span style={{ width: 14, height: 3, borderRadius: 2, background: k ? (selected ? "#fff" : tok(k, "dot")) : "transparent" }} />
              <span style={{ display: "flex", gap: 3, height: 5 }}>
                {dots.map((c) => (
                  <span key={c} style={{ width: 5, height: 5, borderRadius: "50%", background: selected ? "#fff" : tok(c, "dot") }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MobileAgenda({
  date, items, shiftSchedule, userWatch, onNewEvent, onEventClick,
}: {
  date: Date;
  items: CalendarItem[];
  shiftSchedule: ShiftDay[];
  userWatch?: string;
  onNewEvent?: (date: Date, anchor?: CalendarAnchor) => void;
  onEventClick?: (item: CalendarItem, anchor?: CalendarAnchor) => void;
}) {
  const shift = getShiftsForDay(shiftSchedule, date, userWatch)[0];
  const dayItems = items
    .filter((it) => spansDay(it, date))
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startTime.getTime() - b.startTime.getTime());
  return (
    <section className="cal-card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>
            {date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </span>
          {(!!userWatch || shiftSchedule.length > 0) && (
            <span><ShiftChip shift={shift} />{shift?.startTime && <span className="cal-mono" style={{ fontSize: 11, color: "var(--cal-muted)", marginLeft: 6 }}>{shift.startTime}–{shift.endTime}</span>}</span>
          )}
        </div>
        {onNewEvent && (
          <button
            type="button"
            onClick={() => { const at = new Date(date); at.setHours(9, 0, 0, 0); onNewEvent(at); }}
            className="cal-focus"
            style={{ height: 40, padding: "0 14px", borderRadius: 12, border: "none", background: "var(--cal-brand)", color: "#fff", font: "inherit", fontSize: 14, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", flex: "none" }}
          >
            <Plus className="h-4 w-4" /> New event
          </button>
        )}
      </div>
      {dayItems.length === 0 ? (
        <p style={{ margin: 0, padding: "18px 0", textAlign: "center", fontSize: 13, color: "var(--cal-muted)" }}>Nothing on this day</p>
      ) : (
        dayItems.map((it) => {
          const k = calKey(it);
          return (
            <button
              key={`${it.type}-${it.id}`}
              type="button"
              title={itemTooltip(it)}
              onClick={(e) => onEventClick?.(it, anchorOf(e))}
              className="cal-focus"
              style={{
                display: "flex", gap: 10, alignItems: "flex-start", textAlign: "left", font: "inherit", border: "none",
                borderRadius: 12, padding: "10px 12px", background: blockBg(it), color: tok(k, "fg"), cursor: isReadOnly(it) ? "default" : "pointer",
              }}
            >
              <span className="cal-mono" style={{ fontSize: 12, width: 44, flex: "none", paddingTop: 1 }}>
                {it.allDay ? "All day" : hhmm(it.startTime)}
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <Dot k={k} />
                  <span style={{ ...titleStyle(it), fontSize: 14 }}>{it.title}</span>
                  <ItemIcons item={it} />
                </span>
                {!it.allDay && (
                  <span className="cal-mono" style={{ fontSize: 11.5, opacity: 0.85 }}>{hhmm(it.startTime)} – {hhmm(it.endTime)}</span>
                )}
                <StateBadges item={it} />
              </span>
            </button>
          );
        })
      )}
    </section>
  );
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────
function rangeLabel(view: CalendarViewType, d: Date): string {
  if (view === "day") return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  if (view === "week") {
    const days = getWeekDays(d);
    const a = days[0], b = days[6];
    const sameMonth = a.getMonth() === b.getMonth();
    return sameMonth
      ? `${a.getDate()} – ${b.getDate()} ${MONTH_NAMES[b.getMonth()].slice(0, 3)}`
      : `${a.getDate()} ${MONTH_NAMES[a.getMonth()].slice(0, 3)} – ${b.getDate()} ${MONTH_NAMES[b.getMonth()].slice(0, 3)}`;
  }
  if (view === "month") return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  return String(d.getFullYear());
}

function Toolbar({
  view, currentDate, onViewChange, onPrev, onNext, onToday,
}: {
  view: CalendarViewType;
  currentDate: Date;
  onViewChange: (v: CalendarViewType) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const unit = view === "day" ? "day" : view === "week" ? "week" : view === "month" ? "month" : "year";
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button type="button" onClick={onToday} className="cal-btn" style={{ height: 40, padding: "0 16px", fontWeight: 600, fontSize: 14 }}>Today</button>
        <button type="button" aria-label={`Previous ${unit}`} onClick={onPrev} className="cal-btn" style={{ width: 40, height: 40, padding: 0 }}>
          <ChevronLeft className="h-[18px] w-[18px]" />
        </button>
        <button type="button" aria-label={`Next ${unit}`} onClick={onNext} className="cal-btn" style={{ width: 40, height: 40, padding: 0 }}>
          <ChevronRight className="h-[18px] w-[18px]" />
        </button>
        <span className="cal-mono" style={{ fontSize: 14, color: "var(--cal-ink-2)", marginLeft: 6 }}>{rangeLabel(view, currentDate)}</span>
      </div>
      <div role="group" aria-label="View" style={{ display: "inline-flex", padding: 4, borderRadius: 14, background: "var(--cal-surface-3)", gap: 2 }}>
        {(["day", "week", "month", "year"] as CalendarViewType[]).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => onViewChange(v)}
            className="cal-focus capitalize"
            style={{
              height: 36, padding: "0 16px", borderRadius: 10, border: "none", font: "inherit", fontSize: 14, cursor: "pointer",
              ...(view === v
                ? { background: "var(--cal-surface)", color: "var(--cal-ink)", fontWeight: 600, boxShadow: "var(--cal-shadow)" }
                : { background: "transparent", color: "var(--cal-ink-2)", fontWeight: 500 }),
            }}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function CalendarWidget({
  events = [],
  tasks = [],
  inspections = [],
  shiftSchedule = [],
  userWatch,
  currentDate,
  onDateChange,
  view,
  onViewChange,
  onSlotClick,
  onEventClick,
  pendingSlot,
}: CalendarWidgetProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const items = buildItems(events, tasks, inspections);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());

  // Open Day/Week at 07:00, or around now later in the day.
  useEffect(() => {
    if ((view === "day" || view === "week") && scrollRef.current) {
      const h = new Date().getHours();
      scrollRef.current.scrollTop = (h > 14 ? h - 6 : 7) * HOUR_PX;
    }
  }, [view]);

  const navigate = (dir: -1 | 1) => {
    const d = new Date(currentDate);
    if (view === "day") d.setDate(d.getDate() + dir);
    else if (view === "week") d.setDate(d.getDate() + 7 * dir);
    else if (view === "month") d.setMonth(d.getMonth() + dir, 1);
    else d.setFullYear(d.getFullYear() + dir);
    onDateChange(d);
  };
  const toDay = (d: Date) => { onDateChange(d); onViewChange("day"); };

  return (
    <div className="cal-ui" style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      {/* ── Phone ── */}
      <div className="md:hidden" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <MobileMonth
          date={currentDate}
          items={items}
          shiftSchedule={shiftSchedule}
          userWatch={userWatch}
          selectedDay={selectedDay}
          onPrev={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1, 1); onDateChange(d); }}
          onNext={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() + 1, 1); onDateChange(d); }}
          onDaySelect={(d) => {
            setSelectedDay(d);
            if (d.getMonth() !== currentDate.getMonth() || d.getFullYear() !== currentDate.getFullYear()) onDateChange(d);
          }}
        />
        <MobileAgenda
          date={selectedDay}
          items={items}
          shiftSchedule={shiftSchedule}
          userWatch={userWatch}
          onNewEvent={onSlotClick}
          onEventClick={onEventClick}
        />
      </div>

      {/* ── Desktop ── */}
      <div className="hidden md:flex" style={{ flexDirection: "column", gap: 16, minWidth: 0 }}>
        <Toolbar
          view={view}
          currentDate={currentDate}
          onViewChange={onViewChange}
          onPrev={() => navigate(-1)}
          onNext={() => navigate(1)}
          onToday={() => onDateChange(new Date())}
        />
        {(view === "week" || view === "day") && (
          <TimeGridCard
            days={view === "week" ? getWeekDays(currentDate) : [startOfDay(currentDate)]}
            items={items}
            shiftSchedule={shiftSchedule}
            userWatch={userWatch}
            scrollRef={scrollRef}
            pendingSlot={pendingSlot}
            onSlotClick={onSlotClick}
            onEventClick={onEventClick}
            onDayClick={toDay}
          />
        )}
        {view === "month" && (
          <MonthView
            date={currentDate}
            items={items}
            shiftSchedule={shiftSchedule}
            userWatch={userWatch}
            onSlotClick={onSlotClick}
            onEventClick={onEventClick}
            onDayNavigate={toDay}
          />
        )}
        {view === "year" && (
          <YearView
            year={currentDate.getFullYear()}
            items={items}
            onMonthClick={(d) => { onDateChange(d); onViewChange("month"); }}
          />
        )}
      </div>
    </div>
  );
}
