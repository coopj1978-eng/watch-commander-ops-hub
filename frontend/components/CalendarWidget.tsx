import { useRef, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CalendarEvent } from "~backend/calendar/types";
import type { Task } from "~backend/task/types";
import type { Inspection } from "~backend/inspection/types";
import type { ShiftDay } from "@/lib/shiftRota";

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

interface CalendarWidgetProps {
  events?: CalendarEvent[];
  tasks?: Task[];
  inspections?: Inspection[];
  shiftSchedule?: ShiftDay[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  view: CalendarViewType;
  onViewChange: (view: CalendarViewType) => void;
  onSlotClick?: (date: Date) => void;
  onEventClick?: (item: CalendarItem) => void;
}

// ─── Shift helpers ───────────────────────────────────────────────────────────
const SHIFT_COLORS: Record<string, string> = {
  "1st Day":      "#ca8a04", // yellow-600
  "2nd Day":      "#ca8a04",
  "1st Night":    "#4338ca", // indigo-700
  "2nd Night":    "#4338ca",
  "Annual Leave": "#16a34a", // green-600
};

const SHIFT_ICONS: Record<string, string> = {
  "1st Day":      "☀️",
  "2nd Day":      "☀️",
  "1st Night":    "🌙",
  "2nd Night":    "🌙",
  "Annual Leave": "🌿",
};

/** Background tint for the entire calendar cell, keyed by shift type. */
const SHIFT_CELL_BG_LIGHT: Record<string, string> = {
  "1st Day":      "rgba(234, 179,   8, 0.18)",  // yellow-500
  "2nd Day":      "rgba(234, 179,   8, 0.18)",
  "1st Night":    "rgba( 67,  56, 202, 0.16)",  // indigo-700
  "2nd Night":    "rgba( 67,  56, 202, 0.16)",
  "Annual Leave": "rgba( 22, 163,  74, 0.13)",  // green-600
};

const SHIFT_CELL_BG_DARK: Record<string, string> = {
  "1st Day":      "rgba(234, 179,   8, 0.30)",  // yellow – stronger on dark
  "2nd Day":      "rgba(234, 179,   8, 0.30)",
  "1st Night":    "rgba( 99,  102, 241, 0.32)", // indigo-500 – brighter base
  "2nd Night":    "rgba( 99,  102, 241, 0.32)",
  "Annual Leave": "rgba( 34, 197,  94, 0.22)",  // green-500 – brighter base
};

/** Given the shifts on a day, return the cell background colour (first shift wins). */
function getShiftCellBg(shifts: ShiftDay[], isDark = false): string | undefined {
  if (!shifts.length) return undefined;
  const map = isDark ? SHIFT_CELL_BG_DARK : SHIFT_CELL_BG_LIGHT;
  return map[shifts[0].shiftType];
}

function getShiftsForDay(shiftSchedule: ShiftDay[], date: Date): ShiftDay[] {
  const dateStr = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  return shiftSchedule.filter((s) => s.date === dateStr);
}

/** Full opaque banner — used in Day/Week all-day rows and the mobile agenda panel. */
function ShiftBanner({ shift }: { shift: ShiftDay }) {
  const color = SHIFT_COLORS[shift.shiftType] ?? "#6b7280";
  const icon  = SHIFT_ICONS[shift.shiftType] ?? "";
  const label = shift.startTime
    ? `${icon} ${shift.shiftType} (${shift.startTime}–${shift.endTime})`
    : `${icon} ${shift.shiftType}`;
  return (
    <div
      className="rounded px-1.5 py-0.5 text-white text-[11px] truncate font-medium select-none"
      style={{ backgroundColor: `${color}d9` }}
      title={label}
    >
      {label}
    </div>
  );
}

/** Slim label for month cells — no background (the cell itself is already tinted). */
function ShiftCellLabel({ shift }: { shift: ShiftDay }) {
  const color = SHIFT_COLORS[shift.shiftType] ?? "#6b7280";
  const icon  = SHIFT_ICONS[shift.shiftType] ?? "";
  // Abbreviate: "1st Day" → "Day", "2nd Night" → "Night", "Annual Leave" → "Leave"
  const short = shift.shiftType.replace(/^(1st|2nd)\s+/, "");
  const label = shift.startTime ? `${icon} ${short}` : `${icon} ${short}`;
  return (
    <div
      className="text-[11px] font-semibold truncate leading-tight select-none"
      style={{ color }}
      title={shift.startTime ? `${shift.shiftType} (${shift.startTime}–${shift.endTime})` : shift.shiftType}
    >
      {label}
    </div>
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────
const HOUR_HEIGHT = 64;
const TOTAL_HEIGHT = HOUR_HEIGHT * 24;
const TIME_COL_WIDTH = 56;

// ─── Colour helpers ──────────────────────────────────────────────────────────
function getItemColor(item: CalendarItem): string {
  if (item.type === "task") return "#0ea5e9";
  if (item.type === "inspection") return "#f97316";
  if (item.type === "training") return "#22c55e";
  if (item.calendarType === "station") return "#ef4444";
  if (item.calendarType === "watch") return "#3b82f6";
  if (item.calendarType === "personal") return "#8b5cf6";
  return "#6b7280";
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Date utilities ───────────────────────────────────────────────────────────
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** True if a multi-day (or single-day) event covers the given calendar day. */
function spansDay(item: CalendarItem, day: Date): boolean {
  const start = new Date(item.startTime); start.setHours(0, 0, 0, 0);
  const end   = new Date(item.endTime);   end.setHours(23, 59, 59, 999);
  const d     = new Date(day);            d.setHours(12, 0, 0, 0);
  return d >= start && d <= end;
}

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const displayM = m.toString().padStart(2, "0");
  return `${displayH}:${displayM} ${period}`;
}

// Monday-first week
function getWeekDays(date: Date): Date[] {
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + offset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDaysInMonthGrid(date: Date): (Date | null)[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
}

function getYearMonths(year: number): Date[] {
  return Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));
}

// ─── Map data → CalendarItem ─────────────────────────────────────────────────
function buildItems(
  events: CalendarEvent[],
  tasks: Task[],
  inspections: Inspection[]
): CalendarItem[] {
  const items: CalendarItem[] = [];

  events.forEach((e) => {
    const start = new Date(e.start_time);
    const end = new Date(e.end_time);
    const calType = e.calendar_visibility ?? (e.is_watch_event ? "station" : "personal");
    items.push({
      id: e.id,
      title: e.title,
      startTime: start,
      endTime: end,
      allDay: e.all_day,
      type: e.event_type === "training" ? "training" : "event",
      calendarType: calType as CalendarItem["calendarType"],
      data: e,
    });
  });

  tasks.forEach((t) => {
    if (t.due_at) {
      const due = new Date(t.due_at);
      const end = new Date(due.getTime() + 3600000);
      items.push({
        id: t.id,
        title: t.title,
        startTime: due,
        endTime: end,
        allDay: false,
        type: "task",
        calendarType: "other",
        data: t,
      });
    }
  });

  inspections.forEach((ins) => {
    const start = new Date(ins.scheduled_for);
    const end = new Date(start.getTime() + 7200000);
    items.push({
      id: ins.id,
      title: `${ins.type} – ${ins.address}`,
      startTime: start,
      endTime: end,
      allDay: false,
      type: "inspection",
      calendarType: "other",
      data: ins,
    });
  });

  return items;
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function CurrentTimeLine() {
  const now = new Date();
  const top = now.getHours() * HOUR_HEIGHT + (now.getMinutes() / 60) * HOUR_HEIGHT;
  return (
    <div
      className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
      style={{ top }}
    >
      <div style={{ width: TIME_COL_WIDTH }} className="flex justify-end pr-1">
        <div className="w-2 h-2 rounded-full bg-red-500" />
      </div>
      <div className="flex-1 border-t-2 border-red-500" />
    </div>
  );
}

function TimeLabels() {
  return (
    <>
      {Array.from({ length: 24 }, (_, h) => (
        <div
          key={h}
          className="absolute flex items-start justify-end pr-2"
          style={{ top: h * HOUR_HEIGHT - 9, width: TIME_COL_WIDTH, height: HOUR_HEIGHT }}
        >
          {h > 0 && (
            <span className="text-[11px] text-muted-foreground leading-none">
              {formatHour(h)}
            </span>
          )}
        </div>
      ))}
    </>
  );
}

function HourLines({ leftOffset }: { leftOffset: number }) {
  return (
    <>
      {Array.from({ length: 24 }, (_, h) => (
        <div
          key={h}
          className="absolute right-0 border-t border-border/40"
          style={{ top: h * HOUR_HEIGHT, left: leftOffset }}
        />
      ))}
    </>
  );
}

function EventBlock({
  item,
  style,
  onClick,
}: {
  item: CalendarItem;
  style: React.CSSProperties;
  onClick: () => void;
}) {
  const color = getItemColor(item);
  const heightNum = typeof style.height === "number" ? style.height : 30;
  return (
    <div
      className="absolute rounded-md px-1.5 py-0.5 cursor-pointer overflow-hidden text-white select-none"
      style={{
        ...style,
        backgroundColor: hexToRgba(color, 0.85),
        borderLeft: `3px solid ${color}`,
        fontSize: 11,
        lineHeight: "1.3",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <div className="font-semibold truncate">{item.title}</div>
      {heightNum > 28 && (
        <div className="opacity-80 truncate">
          {formatTime(item.startTime)} – {formatTime(item.endTime)}
        </div>
      )}
    </div>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────────
function DayView({
  date,
  items,
  shiftSchedule = [],
  scrollRef,
  onSlotClick,
  onEventClick,
}: {
  date: Date;
  items: CalendarItem[];
  shiftSchedule?: ShiftDay[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onSlotClick?: (date: Date) => void;
  onEventClick?: (item: CalendarItem) => void;
}) {
  const dayItems = items.filter((it) => !it.allDay && sameDay(it.startTime, date));
  const allDayItems = items.filter((it) => it.allDay && spansDay(it, date));
  const dayShifts = getShiftsForDay(shiftSchedule, date);

  const handleSlotClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-event]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    const y = e.clientY - rect.top + scrollTop;
    const rawMinutes = (y / HOUR_HEIGHT) * 60;
    const roundedMinutes = Math.round(rawMinutes / 30) * 30;
    const clickDate = new Date(date);
    clickDate.setHours(Math.floor(roundedMinutes / 60), roundedMinutes % 60, 0, 0);
    onSlotClick?.(clickDate);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {(allDayItems.length > 0 || dayShifts.length > 0) && (
        <div className="flex border-b border-border bg-muted/30 shrink-0">
          <div style={{ width: TIME_COL_WIDTH }} className="text-[11px] text-muted-foreground text-right pr-2 py-1 shrink-0">
            all-day
          </div>
          <div className="flex-1 flex flex-wrap gap-1 p-1">
            {dayShifts.map((s) => (
              <ShiftBanner key={`shift-${s.date}-${s.shiftType}`} shift={s} />
            ))}
            {allDayItems.map((it) => (
              <div
                key={it.id}
                data-event
                className="rounded px-2 py-0.5 text-white text-xs cursor-pointer"
                style={{ backgroundColor: hexToRgba(getItemColor(it), 0.85) }}
                onClick={() => onEventClick?.(it)}
              >
                {it.title}
              </div>
            ))}
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="relative" style={{ height: TOTAL_HEIGHT }}>
          <TimeLabels />
          <HourLines leftOffset={TIME_COL_WIDTH} />
          <CurrentTimeLine />
          <div
            className="absolute top-0 bottom-0 cursor-pointer"
            style={{ left: TIME_COL_WIDTH, right: 0 }}
            onClick={handleSlotClick}
          >
            {dayItems.map((item) => {
              const top = item.startTime.getHours() * HOUR_HEIGHT + (item.startTime.getMinutes() / 60) * HOUR_HEIGHT;
              const durationMs = item.endTime.getTime() - item.startTime.getTime();
              const height = Math.max((durationMs / 3600000) * HOUR_HEIGHT, 20);
              return (
                <EventBlock
                  key={`${item.type}-${item.id}`}
                  item={item}
                  style={{ top, height, left: 4, right: 4 }}
                  onClick={() => onEventClick?.(item)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────
function WeekView({
  weekDays,
  items,
  shiftSchedule = [],
  scrollRef,
  onSlotClick,
  onEventClick,
  onDayClick,
}: {
  weekDays: Date[];
  items: CalendarItem[];
  shiftSchedule?: ShiftDay[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onSlotClick?: (date: Date) => void;
  onEventClick?: (item: CalendarItem) => void;
  onDayClick?: (date: Date) => void;
}) {
  const today = new Date();
  const allDayCols = weekDays.map((d) => items.filter((it) => it.allDay && spansDay(it, d)));
  const shiftCols  = weekDays.map((d) => getShiftsForDay(shiftSchedule, d));
  const hasAllDay  = allDayCols.some((col) => col.length > 0) || shiftCols.some((col) => col.length > 0);

  const handleColClick = (day: Date, e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-event]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    const y = e.clientY - rect.top + scrollTop;
    const rawMinutes = (y / HOUR_HEIGHT) * 60;
    const roundedMinutes = Math.round(rawMinutes / 30) * 30;
    const clickDate = new Date(day);
    clickDate.setHours(Math.floor(roundedMinutes / 60), roundedMinutes % 60, 0, 0);
    onSlotClick?.(clickDate);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Day headers */}
      <div className="flex border-b border-border bg-card shrink-0" style={{ paddingLeft: TIME_COL_WIDTH }}>
        {weekDays.map((day, i) => {
          const isToday = sameDay(day, today);
          return (
            <div
              key={i}
              className="flex-1 text-center py-2 cursor-pointer hover:bg-muted/40 transition-colors"
              onClick={() => onDayClick?.(day)}
            >
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                {WEEK_LABELS[i]}
              </div>
              <div
                className={`text-sm font-semibold mx-auto w-7 h-7 flex items-center justify-center rounded-full mt-0.5 ${
                  isToday ? "bg-red-500 text-white" : "text-foreground"
                }`}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {hasAllDay && (
        <div className="flex border-b border-border bg-muted/20 shrink-0">
          <div style={{ width: TIME_COL_WIDTH }} className="text-[11px] text-muted-foreground text-right pr-2 py-1 shrink-0">
            all-day
          </div>
          {allDayCols.map((col, i) => (
            <div key={i} className="flex-1 flex flex-col gap-0.5 p-0.5">
              {shiftCols[i].map((s) => (
                <ShiftBanner key={`shift-${s.date}-${s.shiftType}`} shift={s} />
              ))}
              {col.map((it) => (
                <div
                  key={it.id}
                  data-event
                  className="rounded px-1 py-0.5 text-white text-[11px] cursor-pointer truncate"
                  style={{ backgroundColor: hexToRgba(getItemColor(it), 0.85) }}
                  onClick={() => onEventClick?.(it)}
                >
                  {it.title}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex" style={{ height: TOTAL_HEIGHT }}>
          <div className="relative shrink-0" style={{ width: TIME_COL_WIDTH, height: TOTAL_HEIGHT }}>
            <TimeLabels />
          </div>
          <div className="flex flex-1 relative" style={{ height: TOTAL_HEIGHT }}>
            <HourLines leftOffset={0} />
            <CurrentTimeLine />
            {weekDays.map((day, i) => {
              const colItems = items.filter((it) => !it.allDay && sameDay(it.startTime, day));
              return (
                <div
                  key={i}
                  className="flex-1 relative border-l border-border/30 cursor-pointer"
                  onClick={(e) => handleColClick(day, e)}
                >
                  {colItems.map((item) => {
                    const top = item.startTime.getHours() * HOUR_HEIGHT + (item.startTime.getMinutes() / 60) * HOUR_HEIGHT;
                    const durationMs = item.endTime.getTime() - item.startTime.getTime();
                    const height = Math.max((durationMs / 3600000) * HOUR_HEIGHT, 20);
                    return (
                      <EventBlock
                        key={`${item.type}-${item.id}`}
                        item={item}
                        style={{ top, height, left: 2, right: 2 }}
                        onClick={() => onEventClick?.(item)}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────
function MonthView({
  date,
  items,
  shiftSchedule = [],
  onSlotClick,
  onEventClick,
  onDayNavigate,
}: {
  date: Date;
  items: CalendarItem[];
  shiftSchedule?: ShiftDay[];
  onSlotClick?: (date: Date) => void;
  onEventClick?: (item: CalendarItem) => void;
  onDayNavigate?: (date: Date) => void;
}) {
  const today = new Date();
  const cells = getDaysInMonthGrid(date);
  const isDark = document.documentElement.classList.contains("dark");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-muted/20 shrink-0">
        {MONTH_LABELS.map((d) => (
          <div key={d} className="text-center py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 flex-1 overflow-y-auto">
        {cells.map((day, idx) => {
          if (!day) {
            return <div key={`empty-${idx}`} className="border-r border-b border-border/30 bg-muted/10" />;
          }

          const isToday = sameDay(day, today);
          const isCurrentMonth = day.getMonth() === date.getMonth();
          const dayShifts = getShiftsForDay(shiftSchedule, day);
          const dayItems = items.filter((it) => spansDay(it, day));
          const visibleItems = dayItems.slice(0, Math.max(0, 3 - dayShifts.length));
          const overflow = dayItems.length - visibleItems.length;

          const shiftBg = getShiftCellBg(dayShifts, isDark);

          return (
            <div
              key={day.toISOString()}
              className={`border-r border-b border-border/30 p-1 min-h-[100px] cursor-pointer transition-colors hover:brightness-95 ${
                !isCurrentMonth ? "opacity-40" : ""
              }`}
              style={shiftBg ? { backgroundColor: shiftBg } : undefined}
              onClick={() => onSlotClick?.(day)}
            >
              <div className="flex justify-center mb-1">
                <span
                  className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                    isToday ? "bg-red-500 text-white" : "text-foreground"
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>
              <div className="space-y-0.5">
                {dayShifts.map((s) => (
                  <div key={`shift-${s.date}-${s.shiftType}`} onClick={(e) => e.stopPropagation()}>
                    <ShiftCellLabel shift={s} />
                  </div>
                ))}
                {visibleItems.map((item) => {
                  const color = getItemColor(item);
                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      data-event
                      className="rounded px-1.5 py-0.5 text-white text-[11px] truncate cursor-pointer"
                      style={{ backgroundColor: hexToRgba(color, 0.85) }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick?.(item);
                      }}
                    >
                      {!item.allDay && (
                        <span className="opacity-80 mr-1">
                          {item.startTime.getHours().toString().padStart(2, "0")}:
                          {item.startTime.getMinutes().toString().padStart(2, "0")}
                        </span>
                      )}
                      {item.title}
                    </div>
                  );
                })}
                {overflow > 0 && (
                  <div
                    className="text-[11px] text-muted-foreground pl-1 cursor-pointer hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDayNavigate?.(day);
                    }}
                  >
                    +{overflow} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Year View ────────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

function YearView({
  year,
  items,
  onMonthClick,
}: {
  year: number;
  items: CalendarItem[];
  onMonthClick: (date: Date) => void;
}) {
  const today = new Date();
  const months = getYearMonths(year);

  return (
    <div className="grid grid-cols-4 gap-4 p-4 overflow-y-auto h-full">
      {months.map((monthDate, mi) => {
        const cells = getDaysInMonthGrid(monthDate);
        const monthItems = items.filter(
          (it) => it.startTime.getFullYear() === year && it.startTime.getMonth() === mi
        );
        const itemDays = new Set(monthItems.map((it) => it.startTime.getDate()));

        return (
          <div
            key={mi}
            className="rounded-xl border border-border bg-card p-3 cursor-pointer hover:border-indigo-500 transition-colors"
            onClick={() => onMonthClick(monthDate)}
          >
            <div className="text-sm font-semibold text-foreground mb-2">{MONTH_NAMES[mi]}</div>
            <div className="grid grid-cols-7 gap-px text-center">
              {MONTH_LABELS.map((d) => (
                <div key={d} className="text-[9px] text-muted-foreground font-medium pb-0.5">
                  {d.slice(0, 1)}
                </div>
              ))}
              {cells.map((day, di) => {
                if (!day) return <div key={`e-${di}`} />;
                const isToday = sameDay(day, today);
                const hasEvents = itemDays.has(day.getDate());
                return (
                  <div key={di} className="flex flex-col items-center">
                    <span
                      className={`text-[10px] w-5 h-5 flex items-center justify-center rounded-full ${
                        isToday ? "bg-red-500 text-white font-bold" : "text-foreground"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {hasEvents && <div className="w-1 h-1 rounded-full bg-red-400 mt-px" />}
                  </div>
                );
              })}
            </div>
            <div className="text-[11px] text-muted-foreground mt-2">
              {monthItems.length} event{monthItems.length !== 1 ? "s" : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Mobile Month View (compact dots) ────────────────────────────────────────
function MobileMonthView({
  date,
  items,
  shiftSchedule = [],
  selectedDay,
  onDaySelect,
}: {
  date: Date;
  items: CalendarItem[];
  shiftSchedule?: ShiftDay[];
  selectedDay: Date;
  onDaySelect: (d: Date) => void;
}) {
  const today = new Date();
  const cells = getDaysInMonthGrid(date);
  const isDark = document.documentElement.classList.contains("dark");

  return (
    <div>
      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 mb-1">
        {MONTH_LABELS.map((d) => (
          <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1">
            {d.slice(0, 2)}
          </div>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} />;

          const isToday      = sameDay(day, today);
          const isSelected   = sameDay(day, selectedDay);
          const inMonth      = day.getMonth() === date.getMonth();
          const dayItems     = items.filter((it) => spansDay(it, day));
          const dayShifts    = getShiftsForDay(shiftSchedule, day);
          const shiftBg      = getShiftCellBg(dayShifts, isDark);

          // Dots for non-shift events only (shift colour already shown via background)
          const eventDotColors: string[] = [];
          dayItems.forEach((it) => {
            const c = getItemColor(it);
            if (!eventDotColors.includes(c)) eventDotColors.push(c);
          });
          const dots = eventDotColors.slice(0, 3);

          return (
            <div
              key={day.toISOString()}
              className={`flex flex-col items-center py-1 cursor-pointer select-none rounded-lg transition-colors ${
                !inMonth ? "opacity-30" : ""
              }`}
              style={shiftBg ? { backgroundColor: shiftBg } : undefined}
              onClick={() => onDaySelect(day)}
            >
              <span
                className={`
                  w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-colors
                  ${isToday && !isSelected ? "text-indigo-600 font-bold" : ""}
                  ${isSelected ? "bg-indigo-600 text-white font-bold shadow-sm" : ""}
                  ${!isSelected && !isToday && inMonth ? "text-foreground" : ""}
                `}
              >
                {day.getDate()}
              </span>
              {/* Event dots (non-shift events only) */}
              <div className="flex gap-[3px] mt-0.5 h-1.5">
                {dots.map((color, i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                ))}
                {dots.length === 0 && <span className="w-1.5 h-1.5" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Mobile Agenda Panel ──────────────────────────────────────────────────────
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function MobileAgendaPanel({
  date,
  items,
  shiftSchedule = [],
  onNewEvent,
}: {
  date: Date;
  items: CalendarItem[];
  shiftSchedule?: ShiftDay[];
  onNewEvent?: (date: Date) => void;
}) {
  const dayLabel = `${DAY_NAMES[date.getDay()]}, ${date.getDate()} ${MONTH_NAMES_FULL[date.getMonth()]}`;
  const dayShifts = getShiftsForDay(shiftSchedule, date);
  const dayItems  = items
    .filter((it) => spansDay(it, date))
    .sort((a, b) => {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return a.startTime.getTime() - b.startTime.getTime();
    });

  const isEmpty = dayShifts.length === 0 && dayItems.length === 0;

  return (
    <div className="border-t border-border bg-background">
      {/* Date header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
        <span className="text-sm font-semibold text-foreground">{dayLabel}</span>
        {onNewEvent && (
          <button
            onClick={() => onNewEvent(date)}
            className="text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1"
          >
            <span className="text-base leading-none">+</span> New Event
          </button>
        )}
      </div>

      {/* Shift banners */}
      {dayShifts.length > 0 && (
        <div className="px-4 py-2 flex flex-wrap gap-1.5 border-b border-border/30 bg-muted/20">
          {dayShifts.map((s) => {
            const color = SHIFT_COLORS[s.shiftType] ?? "#6b7280";
            const icon  = SHIFT_ICONS[s.shiftType] ?? "";
            return (
              <span
                key={`${s.date}-${s.shiftType}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-white text-xs font-medium"
                style={{ backgroundColor: color }}
              >
                {icon} {s.shiftType}
                {s.startTime && <span className="opacity-80">· {s.startTime}–{s.endTime}</span>}
              </span>
            );
          })}
        </div>
      )}

      {/* Events list */}
      <div className="divide-y divide-border/30 max-h-64 overflow-y-auto">
        {isEmpty ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No events
          </div>
        ) : (
          dayItems.map((item) => {
            const color = getItemColor(item);
            return (
              <div key={`${item.type}-${item.id}`} className="flex items-start gap-3 px-4 py-3">
                {/* Time column */}
                <div className="w-14 shrink-0 text-right">
                  {item.allDay ? (
                    <span className="text-[11px] text-muted-foreground">all day</span>
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground">
                      {item.startTime.getHours().toString().padStart(2, "0")}:
                      {item.startTime.getMinutes().toString().padStart(2, "0")}
                    </span>
                  )}
                </div>
                {/* Colour bar */}
                <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: color }} />
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-tight truncate">{item.title}</p>
                  {!item.allDay && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatTime(item.startTime)} – {formatTime(item.endTime)}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
function CalendarHeader({
  view,
  currentDate,
  onViewChange,
  onPrev,
  onNext,
  onToday,
}: {
  view: CalendarViewType;
  currentDate: Date;
  onViewChange: (v: CalendarViewType) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const title = (() => {
    if (view === "day") {
      return currentDate.toLocaleDateString("en-GB", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      });
    }
    if (view === "week") {
      const days = getWeekDays(currentDate);
      const start = days[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      const end = days[6].toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      return `${start} – ${end}`;
    }
    if (view === "month") {
      return currentDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    }
    return currentDate.getFullYear().toString();
  })();

  const views: CalendarViewType[] = ["day", "week", "month", "year"];

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onToday} className="text-xs h-7 px-3">
          Today
        </Button>
        <Button variant="ghost" size="icon" onClick={onPrev} className="h-7 w-7">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onNext} className="h-7 w-7">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <h2 className="text-base font-semibold text-foreground ml-1">{title}</h2>
      </div>
      <div className="flex items-center rounded-lg border border-border overflow-hidden">
        {views.map((v) => (
          <button
            key={v}
            onClick={() => onViewChange(v)}
            className={`px-3 py-1 text-xs font-medium transition-colors capitalize ${
              view === v
                ? "bg-red-500 text-white"
                : "bg-card text-muted-foreground hover:bg-muted"
            }`}
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
  currentDate,
  onDateChange,
  view,
  onViewChange,
  onSlotClick,
  onEventClick,
}: CalendarWidgetProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const items = buildItems(events, tasks, inspections);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());

  useEffect(() => {
    if ((view === "day" || view === "week") && scrollRef.current) {
      const now = new Date();
      scrollRef.current.scrollTop = Math.max(now.getHours() * HOUR_HEIGHT - HOUR_HEIGHT * 2, 0);
    }
  }, [view]);

  const navigate = (dir: -1 | 1) => {
    const d = new Date(currentDate);
    if (view === "day") d.setDate(d.getDate() + dir);
    else if (view === "week") d.setDate(d.getDate() + 7 * dir);
    else if (view === "month") d.setMonth(d.getMonth() + dir);
    else d.setFullYear(d.getFullYear() + dir);
    onDateChange(d);
  };

  const handleDayNavigate = (date: Date) => {
    onDateChange(date);
    onViewChange("day");
  };

  // Mobile month title
  const mobileTitle = currentDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col bg-background rounded-xl border border-border overflow-hidden h-full min-h-[500px]">

      {/* ── MOBILE layout (hidden on md+) ── */}
      <div className="md:hidden flex flex-col h-full">
        {/* Mobile header: month nav only */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="text-center">
            <h2 className="text-base font-semibold text-foreground">{mobileTitle}</h2>
          </div>
          <button
            onClick={() => navigate(1)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Mobile month grid */}
        <div className="px-3 pt-2 pb-1 shrink-0">
          <MobileMonthView
            date={currentDate}
            items={items}
            shiftSchedule={shiftSchedule}
            selectedDay={selectedDay}
            onDaySelect={(d) => {
              setSelectedDay(d);
              // If switching months, navigate the calendar too
              if (d.getMonth() !== currentDate.getMonth() || d.getFullYear() !== currentDate.getFullYear()) {
                onDateChange(d);
              }
            }}
          />
        </div>

        {/* Mobile agenda panel — fills remaining space */}
        <div className="flex-1 overflow-hidden">
          <MobileAgendaPanel
            date={selectedDay}
            items={items}
            shiftSchedule={shiftSchedule}
            onNewEvent={onSlotClick}
          />
        </div>
      </div>

      {/* ── DESKTOP layout (hidden below md) ── */}
      <div className="hidden md:flex md:flex-col md:h-full md:overflow-hidden">
        <CalendarHeader
          view={view}
          currentDate={currentDate}
          onViewChange={onViewChange}
          onPrev={() => navigate(-1)}
          onNext={() => navigate(1)}
          onToday={() => onDateChange(new Date())}
        />
        <div className="flex-1 overflow-hidden">
          {view === "day" && (
            <DayView
              date={currentDate}
              items={items}
              shiftSchedule={shiftSchedule}
              scrollRef={scrollRef}
              onSlotClick={onSlotClick}
              onEventClick={onEventClick}
            />
          )}
          {view === "week" && (
            <WeekView
              weekDays={getWeekDays(currentDate)}
              items={items}
              shiftSchedule={shiftSchedule}
              scrollRef={scrollRef}
              onSlotClick={onSlotClick}
              onEventClick={onEventClick}
              onDayClick={handleDayNavigate}
            />
          )}
          {view === "month" && (
            <MonthView
              date={currentDate}
              items={items}
              shiftSchedule={shiftSchedule}
              onSlotClick={onSlotClick}
              onEventClick={onEventClick}
              onDayNavigate={handleDayNavigate}
            />
          )}
          {view === "year" && (
            <YearView
              year={currentDate.getFullYear()}
              items={items}
              onMonthClick={(d) => {
                onDateChange(d);
                onViewChange("month");
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
