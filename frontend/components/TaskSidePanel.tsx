import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Moon, Sun } from "lucide-react";
import backend from "@/lib/backend";
import { useAuth } from "@/App";
import { getShiftForDate, getWatchShiftStatus, hasRotaConfig, type ShiftDay } from "@/lib/shiftRota";
import { getLabelById } from "@/lib/taskLabels";
import type { Task } from "~backend/task/types";

// The Tasks page's right-hand panel (Claude Design, Oct 2026). It is the
// WATCH'S OWN calendar only: this watch's tasks, its Watch Calendar events and
// its rota — never Station or Personal events (those stay on the Calendar page).

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["M", "T", "W", "T", "F", "S", "S"];

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysFromToday = (d: Date) => Math.round((startOfDay(d).getTime() - startOfDay(new Date()).getTime()) / 86400000);
const shortDate = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

function shiftKind(s: ShiftDay | null): "day" | "night" | "leave" | null {
  if (!s) return null;
  if (s.isLeave) return "leave";
  if (!s.isWorking) return null;
  return s.startTime === "18:00" ? "night" : "day";
}

interface WatchEvent { id: number; title: string; start: Date; allDay: boolean }

/** This watch's tasks due (open ones) and Watch Calendar events for a date range. */
function useWatchCalendar(tasks: Task[], from: Date, to: Date) {
  const { user } = useAuth();
  const { data: events = [] } = useQuery({
    queryKey: ["cal-watch-tasks-panel", user?.id, user?.watch_unit, dayKey(from), dayKey(to)],
    queryFn: async () => {
      const r = await backend.calendar.list({
        calendar_visibility: "watch" as any,
        user_id: user!.id,
        start_date: from.toISOString(),
        end_date: to.toISOString(),
      });
      return r.events
        .filter((e: any) => !e.cancelled_at)
        .map((e: any): WatchEvent => ({ id: e.id, title: e.title, start: new Date(e.start_time), allDay: !!e.all_day }));
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const byDay = useMemo(() => {
    const map = new Map<string, { task: boolean; overdue: boolean; event: boolean }>();
    const get = (k: string) => map.get(k) ?? (map.set(k, { task: false, overdue: false, event: false }), map.get(k)!);
    for (const t of tasks) {
      if (!t.due_at || t.status === "Done") continue;
      const due = new Date(t.due_at);
      const e = get(dayKey(due));
      e.task = true;
      if (daysFromToday(due) < 0) e.overdue = true;
    }
    for (const ev of events) get(dayKey(ev.start)).event = true;
    return map;
  }, [tasks, events]);

  return { events, byDay };
}

function ShiftPill({ watch, small }: { watch: string; small?: boolean }) {
  const s = getWatchShiftStatus(watch);
  if (!s) return null;
  const k = s.state === "on" && s.current ? (s.current.startTime === "18:00" ? "night" : "day") : s.state === "leave" ? "leave" : null;
  const main = s.state === "on" && s.current ? s.current.shiftType : s.label;
  const sub = s.state === "on" && s.current
    ? (small ? `${s.current.startTime?.slice(0, 2)}–${s.current.endTime?.slice(0, 2)}` : `${s.current.startTime}–${s.current.endTime}`)
    : small ? "" : s.nextLabel ? `next ${s.nextLabel}` : "";
  const Icon = k === "night" ? Moon : k === "day" ? Sun : null;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: small ? 4 : 6, padding: small ? "2px 8px" : "5px 10px", borderRadius: 999,
        fontSize: small ? 11 : 12, fontWeight: 600, flexWrap: "wrap",
        background: k ? `var(--cal-${k}-bg)` : "var(--cal-surface-2)", color: k ? `var(--cal-${k}-fg)` : "var(--cal-ink-2)",
      }}
    >
      {Icon && !small && <Icon className="h-[13px] w-[13px]" strokeWidth={2.2} />}
      {main}
      {sub && <span className="cal-mono" style={{ fontWeight: 500 }}>{sub}</span>}
    </span>
  );
}

const dotStyle = (bg: string, size = 5): React.CSSProperties => ({ width: size, height: size, borderRadius: "50%", background: bg });

interface PanelProps {
  watch: string;
  tasks: Task[];
  /** Day the board is filtered to (tasks due that day), or null. */
  selectedDay: Date | null;
  onPickDay: (d: Date | null) => void;
  onOpenTask: (task: Task) => void;
}

/** Desktop right-hand panel: today + shift, mini month, Upcoming list. */
export default function TaskSidePanel({ watch, tasks, selectedDay, onPickDay, onOpenTask }: PanelProps) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const y = cursor.getFullYear(), m = cursor.getMonth();
  const monthEnd = new Date(y, m + 1, 1);
  // Load from the start of the shown month (or today) to 60 days ahead, so Upcoming has enough.
  const from = cursor < startOfDay(today) ? cursor : startOfDay(today);
  const to = new Date(Math.max(monthEnd.getTime(), startOfDay(today).getTime() + 60 * 86400000));
  const { events, byDay } = useWatchCalendar(tasks, from, to);
  const rota = hasRotaConfig(watch);

  const blanks = (new Date(y, m, 1).getDay() + 6) % 7;
  const n = new Date(y, m + 1, 0).getDate();

  const upcoming = useMemo(() => buildUpcoming(tasks, events), [tasks, events]);
  const dayEvents = selectedDay ? events.filter((e) => dayKey(e.start) === dayKey(selectedDay)) : [];

  return (
    <aside aria-label={`${watch} Watch calendar`} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section className="cal-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
        <span className="cal-mono" style={{ fontSize: 11, letterSpacing: ".12em", color: "var(--cal-muted)", textTransform: "uppercase" }}>{watch} Watch calendar</span>
        <span style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}>
          {today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </span>
        {rota && <span style={{ alignSelf: "flex-start" }}><ShiftPill watch={watch} /></span>}
        <div style={{ height: 1, background: "var(--cal-line)", margin: "4px 0" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{MONTHS[m]} {y}</h2>
          <div style={{ display: "flex", gap: 4 }}>
            <button type="button" aria-label="Previous month" onClick={() => setCursor(new Date(y, m - 1, 1))} className="cal-btn" style={{ width: 32, height: 32, padding: 0, borderRadius: 10, color: "var(--cal-ink-2)" }}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" aria-label="Next month" onClick={() => setCursor(new Date(y, m + 1, 1))} className="cal-btn" style={{ width: 32, height: 32, padding: 0, borderRadius: 10, color: "var(--cal-ink-2)" }}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", rowGap: 3, columnGap: 2, textAlign: "center" }}>
          {DOW.map((w, i) => <span key={i} style={{ fontSize: 11, fontWeight: 600, color: "var(--cal-muted)", padding: "2px 0" }}>{w}</span>)}
          {Array.from({ length: blanks }, (_, i) => <span key={`b${i}`} />)}
          {Array.from({ length: n }, (_, i) => {
            const d = new Date(y, m, i + 1);
            const k = rota ? shiftKind(getShiftForDate(watch, d)) : null;
            const info = byDay.get(dayKey(d));
            const isToday = dayKey(d) === dayKey(today);
            const isSel = !!selectedDay && dayKey(d) === dayKey(selectedDay);
            return (
              <button
                key={i}
                type="button"
                onClick={() => onPickDay(isSel ? null : d)}
                aria-pressed={isSel}
                aria-label={`${d.getDate()} ${MONTHS[m]}${k ? `, ${k === "leave" ? "annual leave" : `${k} shift`}` : ", rest day"}${info?.overdue ? ", overdue tasks" : info?.task ? ", tasks due" : ""}${info?.event ? ", watch event" : ""}${isToday ? ", today" : ""}`}
                className="cal-focus"
                style={{
                  height: 40, border: "none", borderRadius: 9, padding: 0, font: "inherit", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                  background: k ? `var(--cal-${k}-cell)` : "transparent",
                  boxShadow: isSel ? "inset 0 0 0 2px var(--cal-brand)" : undefined,
                }}
              >
                <span
                  className="cal-mono"
                  style={{
                    fontSize: 12.5, fontWeight: isToday ? 700 : 500, width: 24, height: 22, borderRadius: 7, display: "grid", placeItems: "center",
                    ...(isToday ? { background: "var(--cal-brand)", color: "#fff" } : { color: "var(--cal-ink)" }),
                  }}
                >
                  {d.getDate()}
                </span>
                <span style={{ display: "flex", gap: 2, height: 5 }}>
                  {info?.task && <span style={dotStyle(info.overdue ? "var(--cal-station-dot)" : "var(--cal-ink-2)")} />}
                  {info?.event && <span style={dotStyle("var(--cal-watch-dot)")} />}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 11, color: "var(--cal-muted)", paddingTop: 2 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={dotStyle("var(--cal-ink-2)", 6)} />Task due</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={dotStyle("var(--cal-station-dot)", 6)} />Overdue</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={dotStyle("var(--cal-watch-dot)", 6)} />Watch event</span>
          {rota && (["day", "night", "leave"] as const).map((k) => (
            <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 12, height: 8, borderRadius: 3, background: `var(--cal-${k}-cell)`, border: `1px solid var(--cal-${k}-dot)` }} />
              {k === "day" ? "Day" : k === "night" ? "Night" : "Leave"}
            </span>
          ))}
        </div>

        {selectedDay && (
          <div style={{ borderTop: "1px solid var(--cal-line)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--cal-ink-2)" }}>
              {shortDate(selectedDay)} · showing tasks due this day
            </span>
            {dayEvents.length === 0 ? (
              <span style={{ fontSize: 12, color: "var(--cal-muted)" }}>No watch events this day.</span>
            ) : dayEvents.map((e) => (
              <Link key={e.id} to={`/calendar?date=${dayKey(e.start)}`} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 13, color: "var(--cal-watch-fg)", background: "var(--cal-watch-bg)", padding: "6px 10px", borderRadius: 10, textDecoration: "none" }}>
                <span className="cal-mono" style={{ fontSize: 11 }}>{e.allDay ? "All day" : hhmm(e.start)}</span>
                <span style={{ fontWeight: 600 }}>{e.title}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Upcoming" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "0 4px" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Upcoming</h2>
          <span style={{ fontSize: 12, color: "var(--cal-muted)" }}>Tasks + watch events</span>
        </div>
        {upcoming.length === 0 && (
          <span style={{ fontSize: 13, color: "var(--cal-muted)", padding: "4px" }}>Nothing due — the watch is all clear.</span>
        )}
        {upcoming.map((u) => {
          const body = (
            <>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%" }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{u.tag}</span>
                <span className="cal-mono" style={{ fontSize: 11, fontWeight: 500, whiteSpace: "nowrap" }}>{u.when}</span>
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{u.title}</span>
            </>
          );
          const style: React.CSSProperties = {
            display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, padding: "14px 16px", borderRadius: 18,
            border: u.kind === "plain" ? "1px solid var(--cal-line)" : "none", font: "inherit", textAlign: "left", cursor: "pointer",
            textDecoration: "none", ...UPCOMING_COLOURS[u.kind],
          };
          return u.task ? (
            <button key={u.key} type="button" className="cal-focus" style={style} onClick={() => onOpenTask(u.task!)} aria-label={`${u.title}, ${u.when}, ${u.tag}`}>{body}</button>
          ) : (
            <Link key={u.key} to={`/calendar?date=${u.date}`} className="cal-focus" style={style} aria-label={`${u.title}, ${u.when}, Watch Calendar`}>{body}</Link>
          );
        })}
        <Link to="/calendar" style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 4px", fontSize: 14, fontWeight: 600, color: "var(--cal-brand-text)", textDecoration: "none" }}>
          Open watch calendar <ArrowRight className="h-[15px] w-[15px]" />
        </Link>
      </section>
    </aside>
  );
}

const UPCOMING_COLOURS: Record<string, React.CSSProperties> = {
  over: { background: "var(--cal-station-bg)", color: "var(--cal-station-fg)" },
  soon: { background: "var(--cal-day-bg)", color: "var(--cal-day-fg)" },
  ev: { background: "var(--cal-watch-bg)", color: "var(--cal-watch-fg)" },
  plain: { background: "var(--cal-surface)", color: "var(--cal-ink)" },
};

interface UpcomingItem { key: string; kind: "over" | "soon" | "ev" | "plain"; tag: string; when: string; title: string; at: number; date: string; task?: Task }

/** Overdue first, then the next tasks and watch events by date — six in all. */
function buildUpcoming(tasks: Task[], events: WatchEvent[]): UpcomingItem[] {
  const now = Date.now();
  const items: UpcomingItem[] = [];
  for (const t of tasks) {
    if (!t.due_at || t.status === "Done") continue;
    const due = new Date(t.due_at);
    const diff = daysFromToday(due);
    const label = (t.tags ?? []).map(getLabelById).find(Boolean)?.name ?? (t.category && t.category !== "Other" ? t.category : "Task");
    const rel = diff < 0 ? `Overdue ${-diff}d` : diff === 0 ? "Today" : diff <= 3 ? `In ${diff}d` : "";
    items.push({
      key: `t${t.id}`, kind: diff < 0 ? "over" : diff <= 3 ? "soon" : "plain",
      tag: rel ? `${label} · ${rel}` : label, when: shortDate(due), title: t.title,
      at: diff < 0 ? -1e15 + due.getTime() : startOfDay(due).getTime(), date: dayKey(due), task: t,
    });
  }
  for (const e of events) {
    if (e.start.getTime() < now - (e.allDay ? 86400000 : 0)) continue;
    const diff = daysFromToday(e.start);
    const day = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : shortDate(e.start);
    items.push({
      key: `e${e.id}`, kind: "ev", tag: "Watch Calendar", when: e.allDay ? `${day} · all day` : `${day} ${hhmm(e.start)}`,
      title: e.title, at: e.start.getTime(), date: dayKey(e.start),
    });
  }
  return items.sort((a, b) => a.at - b.at).slice(0, 6);
}

/** Phone: a tappable card with today's shift and this week's strip; opens the full panel. */
export function TaskWeekStrip({ watch, tasks, selectedDay, onPickDay, onOpenTask }: PanelProps) {
  const [open, setOpen] = useState(false);
  const today = startOfDay(new Date());
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const { byDay } = useWatchCalendar(tasks, monday, new Date(monday.getTime() + 7 * 86400000));
  const rota = hasRotaConfig(watch);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`${watch} Watch calendar. ${open ? "Close" : "Open"}`}
        className="cal-focus"
        style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px", borderRadius: 16, border: "none", background: "var(--cal-surface)", boxShadow: "var(--cal-card-shadow)", font: "inherit", color: "var(--cal-ink)", textAlign: "left", cursor: "pointer" }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{shortDate(today)}</span>
          {rota && <ShiftPill watch={watch} small />}
          <ChevronDown className="h-4 w-4" style={{ marginLeft: "auto", color: "var(--cal-muted)", transform: open ? "rotate(180deg)" : undefined, transition: "transform .15s" }} />
        </span>
        <span style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 3, width: "100%" }}>
          {DOW.map((w, i) => {
            const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
            const k = rota ? shiftKind(getShiftForDate(watch, d)) : null;
            const info = byDay.get(dayKey(d));
            const isToday = dayKey(d) === dayKey(today);
            return (
              <span
                key={i}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 1, padding: "4px 0", borderRadius: 9,
                  ...(isToday ? { background: "var(--cal-brand)", color: "#fff" } : { background: k ? `var(--cal-${k}-cell)` : "transparent" }),
                }}
              >
                <span style={{ fontSize: 10, opacity: 0.8 }}>{w}</span>
                <span className="cal-mono" style={{ fontSize: 13, fontWeight: 600 }}>{d.getDate()}</span>
                <span style={{ display: "flex", gap: 2, height: 4 }}>
                  {info?.task && <span style={dotStyle(info.overdue ? "var(--cal-station-dot)" : isToday ? "#fff" : "var(--cal-ink-2)", 4)} />}
                  {info?.event && <span style={dotStyle(isToday ? "#bfdbfe" : "var(--cal-watch-dot)", 4)} />}
                </span>
              </span>
            );
          })}
        </span>
      </button>
      {open && <TaskSidePanel watch={watch} tasks={tasks} selectedDay={selectedDay} onPickDay={onPickDay} onOpenTask={onOpenTask} />}
    </div>
  );
}
