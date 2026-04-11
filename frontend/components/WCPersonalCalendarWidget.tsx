import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { getShiftsForDateRange, hasRotaConfig } from "@/lib/shiftRota";
import type { ShiftDay } from "@/lib/shiftRota";

// ── Shift cell backgrounds (matching CalendarWidget.tsx exactly) ─────────────

const SHIFT_CELL_BG_LIGHT: Record<string, string> = {
  "1st Day":      "rgba(234, 179,   8, 0.18)",
  "2nd Day":      "rgba(234, 179,   8, 0.18)",
  "1st Night":    "rgba( 67,  56, 202, 0.16)",
  "2nd Night":    "rgba( 67,  56, 202, 0.16)",
  "Annual Leave": "rgba( 22, 163,  74, 0.13)",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDaysInMonthGrid(date: Date): (Date | null)[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
}

function getEventColour(ev: { event_type: string; calendar_visibility?: string }): string {
  if (ev.event_type === "training") return "#22c55e";
  if (ev.event_type === "inspection") return "#f97316";
  if (ev.event_type === "meeting") return "#8b5cf6";
  if (ev.event_type === "maintenance") return "#14b8a6";
  if (ev.calendar_visibility === "station") return "#ef4444";
  if (ev.calendar_visibility === "watch") return "#3b82f6";
  return "#8b5cf6";
}

type EventEntry = {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  event_type: string;
  calendar_visibility?: string;
  location?: string;
};

/** Check if an event covers a given day */
function eventSpansDay(ev: EventEntry, day: Date): boolean {
  const s = new Date(ev.start_time); s.setHours(0, 0, 0, 0);
  const e = new Date(ev.end_time);   e.setHours(23, 59, 59, 999);
  const d = new Date(day);           d.setHours(12, 0, 0, 0);
  return d >= s && d <= e;
}

/** Get up to 3 unique dot colours for events on a given day */
function getDotsForDay(day: Date, events: EventEntry[]): string[] {
  const colours = new Set<string>();
  for (const ev of events) {
    if (eventSpansDay(ev, day)) {
      colours.add(getEventColour(ev));
      if (colours.size >= 3) break;
    }
  }
  return Array.from(colours);
}

// ── Component ────────────────────────────────────────────────────────────────

export function WCPersonalCalendarWidget() {
  const { user } = useAuth();
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [viewDate, setViewDate] = useState(() => new Date(today));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const userWatch = user?.watch_unit ?? "";
  const rotaAvailable = hasRotaConfig(userWatch);

  // Fetch events for the visible month
  const { startISO, endISO } = useMemo(() => {
    const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const end = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0, 23, 59, 59);
    return { startISO: start.toISOString(), endISO: end.toISOString() };
  }, [viewDate]);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["personal-cal-widget", user?.id, startISO, endISO],
    queryFn: async () => {
      const result = await backend.calendar.list({
        user_id: user?.id,
        start_date: startISO,
        end_date: endISO,
      });
      return (result.events ?? []) as EventEntry[];
    },
    enabled: !!user?.id,
  });

  // Compute shift schedule for the month (no network call)
  const shiftMap = useMemo(() => {
    if (!rotaAvailable) return new Map<string, ShiftDay>();
    const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const end = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
    const shifts = getShiftsForDateRange(userWatch, start, end);
    const map = new Map<string, ShiftDay>();
    for (const s of shifts) map.set(s.date, s);
    return map;
  }, [userWatch, rotaAvailable, viewDate]);

  const cells = useMemo(() => getDaysInMonthGrid(viewDate), [viewDate]);

  // Events for the selected day
  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return [];
    return events
      .filter((ev) => eventSpansDay(ev, selectedDay))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [selectedDay, events]);

  const selectedDayShift = selectedDay ? shiftMap.get(toDateKey(selectedDay)) : null;

  // Count events today
  const todayCount = useMemo(
    () => events.filter((ev) => eventSpansDay(ev, today)).length,
    [events, today]
  );

  const monthLabel = viewDate.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const prevMonth = () => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    setSelectedDay(null);
  };
  const nextMonth = () => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    setSelectedDay(null);
  };

  const handleDayClick = (day: Date) => {
    if (selectedDay && sameDay(selectedDay, day)) {
      setSelectedDay(null); // toggle off
    } else {
      setSelectedDay(day);
    }
  };

  return (
    <Card className="border-t-2 border-t-indigo-500">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-indigo-500" />
          <CardTitle className="text-sm font-medium">My Calendar</CardTitle>
        </div>
        {todayCount > 0 ? (
          <Badge
            variant="outline"
            className="text-[10px] bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800"
          >
            {todayCount} today
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            Clear today
          </Badge>
        )}
      </CardHeader>

      <CardContent className="pt-0 pb-3">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={prevMonth}
            className="p-1 rounded hover:bg-muted transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <span className="text-xs font-semibold text-foreground">{monthLabel}</span>
          <button
            onClick={nextMonth}
            className="p-1 rounded hover:bg-muted transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-0.5">
          {DAY_LABELS.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] font-medium text-muted-foreground py-0.5"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="py-1" />;
            }

            const isToday = sameDay(day, today);
            const isSelected = selectedDay ? sameDay(day, selectedDay) : false;
            const dots = getDotsForDay(day, events);
            const shift = shiftMap.get(toDateKey(day));
            const shiftBg = shift ? SHIFT_CELL_BG_LIGHT[shift.shiftType] : undefined;

            return (
              <div
                key={day.toISOString()}
                className={`flex flex-col items-center py-0.5 cursor-pointer select-none rounded-md transition-all ${
                  isSelected
                    ? "ring-1 ring-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/30"
                    : "hover:bg-muted/50"
                }`}
                style={!isSelected && shiftBg ? { backgroundColor: shiftBg } : undefined}
                onClick={() => handleDayClick(day)}
              >
                {/* Date number */}
                <span
                  className={`w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-medium transition-colors ${
                    isToday && !isSelected
                      ? "bg-indigo-600 text-white font-bold shadow-sm"
                      : isSelected
                      ? "bg-indigo-600 text-white font-bold shadow-sm"
                      : isToday
                      ? "bg-indigo-600 text-white font-bold shadow-sm"
                      : "text-foreground"
                  }`}
                >
                  {day.getDate()}
                </span>

                {/* Event dots */}
                <div className="flex gap-[2px] mt-[1px] h-1.5">
                  {dots.length > 0
                    ? dots.map((color, i) => (
                        <span
                          key={i}
                          className="w-1 h-1 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                      ))
                    : <span className="w-1 h-1" />
                  }
                </div>
              </div>
            );
          })}
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div className="text-center py-2">
            <span className="text-[10px] text-muted-foreground animate-pulse">Loading events…</span>
          </div>
        )}

        {/* ── Selected day detail panel ──────────────────────────────────── */}
        {selectedDay && (
          <div className="mt-2 border-t border-border/40 pt-2">
            {/* Day header */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-foreground">
                {selectedDay.toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </span>
              <div className="flex items-center gap-1.5">
                {selectedDayShift && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0"
                    style={{
                      color: selectedDayShift.shiftType.includes("Night") ? "#4338ca" : "#ca8a04",
                      borderColor: selectedDayShift.shiftType.includes("Night") ? "#4338ca40" : "#ca8a0440",
                      backgroundColor: selectedDayShift.shiftType.includes("Night") ? "#4338ca10" : "#ca8a0410",
                    }}
                  >
                    {selectedDayShift.shiftType.includes("Night") ? "🌙" : "☀️"}{" "}
                    {selectedDayShift.shiftType}
                  </Badge>
                )}
                <Link
                  to={`/calendar?date=${toDateKey(selectedDay)}`}
                  className="text-[10px] text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5"
                >
                  Open <ExternalLink className="h-2.5 w-2.5" />
                </Link>
              </div>
            </div>

            {/* Events list */}
            {selectedDayEvents.length === 0 ? (
              <p className="text-[11px] text-muted-foreground py-1">
                No events scheduled
              </p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {selectedDayEvents.map((ev) => {
                  const start = new Date(ev.start_time);
                  const time = ev.all_day
                    ? "All day"
                    : start.toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                  const dotColour = getEventColour(ev);

                  return (
                    <div
                      key={ev.id}
                      className="flex items-start gap-2 px-1.5 py-1 rounded bg-muted/30"
                    >
                      <span
                        className="mt-1 h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: dotColour }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-foreground truncate leading-tight">
                          {ev.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5" />
                            {time}
                          </span>
                          {ev.location && (
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground truncate">
                              <MapPin className="h-2.5 w-2.5 shrink-0" />
                              {ev.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer CTA */}
        <Link
          to="/calendar"
          className="mt-2 flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary transition-colors group border-t border-border/40 pt-2"
        >
          View full calendar
          <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </CardContent>
    </Card>
  );
}
