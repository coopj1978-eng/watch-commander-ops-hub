import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, ChevronDown, Moon, Sun } from "lucide-react";
import backend from "@/lib/backend";
import { useAuth } from "@/App";
import { getWatchShiftStatus, hasRotaConfig } from "@/lib/shiftRota";
import { buildUpcoming, dayKey, daysFromToday, type CalEvent, type UpcomingItem } from "@/lib/taskUpcoming";
import { CALENDAR_EVENTS_KEY } from "@/lib/calendarQueries";
import type { Task } from "~backend/task/types";

// The Tasks page's right-hand panel: today's shift, station checks missed, and
// what's coming up — this watch's tasks, its Watch Calendar events and Station
// events. Personal events stay on the Calendar page. (The small month calendar
// was taken out in Nov 2026 — John: the Calendar page is the one calendar.)

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Watch Calendar and Station events from today to 60 days ahead. */
function usePanelEvents(): CalEvent[] {
  const { user } = useAuth();
  const today = startOfDay(new Date());
  const { data = [] } = useQuery({
    // Under the calendar's key, so adding or changing an event refreshes it.
    queryKey: [CALENDAR_EVENTS_KEY, "tasks-panel", user?.watch_unit, dayKey(today)],
    queryFn: async () => {
      // No user_id: that only matched events flagged is_watch_event, so some
      // watch events went missing. The server's rules pick the watch.
      const load = (calendar_visibility: "watch" | "station") =>
        backend.calendar.list({
          calendar_visibility: calendar_visibility as any,
          start_date: today.toISOString(),
          end_date: new Date(today.getTime() + 60 * 86400000).toISOString(),
          limit: 500,
        });
      const [watch, station] = await Promise.all([load("watch"), load("station")]);
      const pick = (events: any[], isStation: boolean) =>
        events
          .filter((e) => !e.cancelled_at)
          .map((e): CalEvent => ({ id: e.id, title: e.title, start: new Date(e.start_time), allDay: !!e.all_day, station: isStation }));
      return [...pick(watch.events, false), ...pick(station.events, true)];
    },
    enabled: !!user,
    staleTime: 60_000,
  });
  return data;
}

function useMissedChecks() {
  // Station checks nobody did in the last 7 days (shared with the WC dashboard).
  const { data } = useQuery({
    queryKey: ["missed-checks"],
    queryFn: () => backend.task.missedChecks({ days: 7 }),
    staleTime: 5 * 60_000,
  });
  return data?.checks ?? [];
}

function ShiftPill({ watch }: { watch: string }) {
  const s = getWatchShiftStatus(watch);
  if (!s) return null;
  const k = s.state === "on" && s.current ? (s.current.startTime === "18:00" ? "night" : "day") : s.state === "leave" ? "leave" : null;
  const main = s.state === "on" && s.current ? s.current.shiftType : s.label;
  const sub = s.state === "on" && s.current ? `${s.current.startTime}–${s.current.endTime}` : s.nextLabel ? `next ${s.nextLabel}` : "";
  const Icon = k === "night" ? Moon : k === "day" ? Sun : null;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 999,
        fontSize: 12, fontWeight: 600, flexWrap: "wrap",
        background: k ? `var(--cal-${k}-bg)` : "var(--cal-surface-2)", color: k ? `var(--cal-${k}-fg)` : "var(--cal-ink-2)",
      }}
    >
      {Icon && <Icon className="h-[13px] w-[13px]" strokeWidth={2.2} />}
      {main}
      {sub && <span className="cal-mono" style={{ fontWeight: 500 }}>{sub}</span>}
    </span>
  );
}

interface PanelProps {
  watch: string;
  tasks: Task[];
  onOpenTask: (task: Task) => void;
}

/** Desktop right-hand panel (and the phone card's contents): today + shift, missed checks, Upcoming. */
export default function TaskSidePanel({ watch, tasks, onOpenTask, compact }: PanelProps & { compact?: boolean }) {
  const today = new Date();
  const events = usePanelEvents();
  const upcoming = useMemo(() => buildUpcoming(tasks, events), [tasks, events]);
  const missed = useMissedChecks();

  return (
    <aside aria-label={`${watch} Watch: missed checks and upcoming`} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {!compact && (
        <section className="cal-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="cal-mono" style={{ fontSize: 11, letterSpacing: ".12em", color: "var(--cal-muted)", textTransform: "uppercase" }}>{watch} Watch</span>
          <span style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}>
            {today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </span>
          {hasRotaConfig(watch) && <span style={{ alignSelf: "flex-start" }}><ShiftPill watch={watch} /></span>}
        </section>
      )}

      {missed.length > 0 && (
        <section aria-label="Missed station checks" style={{ background: "var(--cal-day-bg)", color: "var(--cal-day-fg)", borderRadius: 18, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}>
            <AlertTriangle className="h-4 w-4" /> Station checks missed · last 7 days
          </span>
          {missed.slice(0, 5).map((c) => {
            const day = new Date(`${c.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
            const when = c.shift === "night" ? `Night ${day}` : c.shift === "day" ? `Day ${day}` : c.freq === "daily" ? day : `${c.freq[0].toUpperCase()}${c.freq.slice(1)} from ${day}`;
            return (
              <div key={c.id} style={{ display: "flex", flexDirection: "column", fontSize: 13, color: "var(--cal-ink)" }}>
                <span style={{ fontWeight: 600 }}>{c.title}</span>
                <span className="cal-mono" style={{ fontSize: 11, color: "var(--cal-ink-2)" }}>
                  {when}{c.watches.length ? ` · ${c.watches.join(" / ")} Watch` : " · station"}
                </span>
              </div>
            );
          })}
          {missed.length > 5 && <span style={{ fontSize: 12 }}>+{missed.length - 5} more</span>}
        </section>
      )}

      <section aria-label="Upcoming" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, padding: "0 4px" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Upcoming</h2>
          <span style={{ fontSize: 12, color: "var(--cal-muted)" }}>Tasks, watch and station events</span>
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
            <Link key={u.key} to={`/calendar?date=${u.date}`} className="cal-focus" style={style} aria-label={`${u.title}, ${u.when}, ${u.tag}`}>{body}</Link>
          );
        })}
        <Link to="/calendar" style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 4px", fontSize: 14, fontWeight: 600, color: "var(--cal-brand-text)", textDecoration: "none" }}>
          Open calendar <ArrowRight className="h-[15px] w-[15px]" />
        </Link>
      </section>
    </aside>
  );
}

const UPCOMING_COLOURS: Record<UpcomingItem["kind"], React.CSSProperties> = {
  over: { background: "var(--cal-danger-bg)", color: "var(--cal-danger-fg)" },
  soon: { background: "var(--cal-day-bg)", color: "var(--cal-day-fg)" },
  ev: { background: "var(--cal-watch-bg)", color: "var(--cal-watch-fg)" },
  station: { background: "var(--cal-station-bg)", color: "var(--cal-station-fg)" },
  plain: { background: "var(--cal-surface)", color: "var(--cal-ink)" },
};

/** Phone: a tappable card with any overdue count; opens missed checks and Upcoming. */
export function TaskUpcomingCard({ watch, tasks, onOpenTask }: PanelProps) {
  const [open, setOpen] = useState(false);
  const overdue = tasks.filter((t) => t.due_at && t.status !== "Done" && daysFromToday(new Date(t.due_at)) < 0).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`Upcoming${overdue ? `, ${overdue} overdue` : ""}. ${open ? "Close" : "Open"}`}
        className="cal-focus"
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 16, border: "none", background: "var(--cal-surface)", boxShadow: "var(--cal-card-shadow)", font: "inherit", color: "var(--cal-ink)", textAlign: "left", cursor: "pointer" }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>Upcoming</span>
        {overdue > 0 && (
          <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "var(--cal-danger-bg)", color: "var(--cal-danger-fg)" }}>
            {overdue} overdue
          </span>
        )}
        <ChevronDown className="h-4 w-4" style={{ marginLeft: "auto", color: "var(--cal-muted)", transform: open ? "rotate(180deg)" : undefined, transition: "transform .15s" }} />
      </button>
      {open && <TaskSidePanel watch={watch} tasks={tasks} onOpenTask={onOpenTask} compact />}
    </div>
  );
}
