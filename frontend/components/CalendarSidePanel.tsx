import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Check, Lock, Moon, Sun, Clock } from "lucide-react";
import type { CalendarEvent } from "~backend/calendar/types";
import type { CalendarViewType } from "./CalendarWidget";
import { getShiftForDate, getWatchShiftStatus, type ShiftDay } from "@/lib/shiftRota";

// Left panel of the calendar page (Claude Design redesign): mini month,
// "Next up" (your shift + next event) and the calendar toggles. Renders
// inside the page's .cal-ui scope.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WATCHES = ["Red", "White", "Green", "Blue", "Amber"] as const;

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const shiftKind = (s?: ShiftDay | null) =>
  !s || s.shiftType === "Rest" ? null : s.isLeave ? "leave" : s.shiftType.includes("Night") ? "night" : "day";

const sectionTitle: React.CSSProperties = { margin: 0, fontSize: 15, fontWeight: 600 };
const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase" };

// ─── Mini month ───────────────────────────────────────────────────────────────
function MiniMonth({
  currentDate, view, rotaWatch, onPickDay,
}: {
  currentDate: Date;
  view: CalendarViewType;
  /** Watch whose shifts to mark under each day (undefined = rota hidden). */
  rotaWatch?: string;
  onPickDay: (d: Date) => void;
}) {
  const [cursor, setCursor] = useState(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
  useEffect(() => {
    setCursor(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
  }, [currentDate.getFullYear(), currentDate.getMonth()]);

  const today = new Date();
  const y = cursor.getFullYear(), m = cursor.getMonth();
  const blanks = (new Date(y, m, 1).getDay() + 6) % 7;
  const n = new Date(y, m + 1, 0).getDate();

  // The days the main calendar is showing get a soft band.
  const dow = (currentDate.getDay() + 6) % 7;
  const weekStart = startOfDay(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - dow));
  const inView = (d: Date) => {
    if (view === "week") { const diff = (startOfDay(d).getTime() - weekStart.getTime()) / 86400000; return diff >= 0 && diff < 7; }
    if (view === "day") return sameDay(d, currentDate);
    return false;
  };

  return (
    <section className="cal-card" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={sectionTitle}>{MONTHS[m]} {y}</h2>
        <div style={{ display: "flex", gap: 4 }}>
          <button type="button" aria-label="Previous month" onClick={() => setCursor(new Date(y, m - 1, 1))} className="cal-btn" style={{ width: 32, height: 32, padding: 0, borderRadius: 10, color: "var(--cal-ink-2)" }}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Next month" onClick={() => setCursor(new Date(y, m + 1, 1))} className="cal-btn" style={{ width: 32, height: 32, padding: 0, borderRadius: 10, color: "var(--cal-ink-2)" }}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", rowGap: 2, textAlign: "center" }}>
        {["M", "T", "W", "T", "F", "S", "S"].map((w, i) => (
          <span key={i} style={{ fontSize: 11, fontWeight: 600, color: "var(--cal-muted)", padding: "4px 0" }}>{w}</span>
        ))}
        {Array.from({ length: blanks }, (_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: n }, (_, i) => {
          const d = new Date(y, m, i + 1);
          const isToday = sameDay(d, today);
          const band = inView(d);
          const prevBand = band && inView(new Date(y, m, i));
          const nextBand = band && inView(new Date(y, m, i + 2));
          const k = rotaWatch ? shiftKind(getShiftForDate(rotaWatch, d)) : null;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPickDay(d)}
              className="cal-focus cal-mono"
              aria-label={`${d.getDate()} ${MONTHS[m]}${k ? `, ${k === "leave" ? "annual leave" : `${k} shift`}` : ""}${isToday ? ", today" : ""}`}
              style={{
                height: 38, border: "none", padding: 0, cursor: "pointer", fontSize: 13, fontWeight: isToday ? 600 : 500,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                borderRadius: isToday ? 10 : band ? `${prevBand ? 0 : 10}px ${nextBand ? 0 : 10}px ${nextBand ? 0 : 10}px ${prevBand ? 0 : 10}px` : 10,
                background: isToday ? "var(--cal-brand)" : band ? "var(--cal-brand-soft)" : "transparent",
                color: isToday ? "#fff" : "var(--cal-ink)",
              }}
            >
              <span>{d.getDate()}</span>
              <span style={{ width: 14, height: 3, borderRadius: 2, background: k ? (isToday ? "#fff" : `var(--cal-${k}-dot)`) : "transparent" }} />
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─── Next up ──────────────────────────────────────────────────────────────────
function whenLabel(d: Date, allDay: boolean): string {
  const today = startOfDay(new Date());
  const diff = Math.round((startOfDay(d).getTime() - today.getTime()) / 86400000);
  const day = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  if (allDay) return `${day} · All day`;
  return `${day} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
const CAL_NAME: Record<string, string> = { station: "Station", watch: "Watch", personal: "Personal" };

function NextUp({ myWatch, upcoming }: { myWatch?: string; upcoming: CalendarEvent[] }) {
  const status = myWatch ? getWatchShiftStatus(myWatch) : null;
  const now = Date.now();
  const todayStart = startOfDay(new Date()).getTime();
  // Next one still to come: all-day events count until their last day ends.
  const nextEvent = upcoming
    .filter((e) => !e.cancelled_at && (e.all_day ? new Date(e.end_time).getTime() >= todayStart : new Date(e.start_time).getTime() >= now))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];

  if (!status && !nextEvent) return null;
  const cur = status?.current;
  const curKind = cur ? shiftKind(cur) : status?.state === "leave" ? "leave" : null;
  const endsNextDay = cur?.startTime === "18:00";
  const endDay = cur ? new Date(new Date(cur.date + "T12:00:00").getTime() + 86400000).toLocaleDateString("en-GB", { weekday: "short" }) : "";

  return (
    <section aria-label="Next up" className="cal-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={sectionTitle}>Next up</h2>
      {status && (
        <div
          style={{
            borderRadius: 14, padding: "12px 14px", display: "flex", gap: 12, alignItems: "center",
            background: curKind ? `var(--cal-${curKind}-bg)` : "var(--cal-surface-2)",
            color: curKind ? `var(--cal-${curKind}-fg)` : "var(--cal-ink)",
          }}
        >
          {curKind === "night" ? <Moon className="h-5 w-5 shrink-0" /> : curKind === "day" ? <Sun className="h-5 w-5 shrink-0" /> : <Clock className="h-5 w-5 shrink-0" />}
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={eyebrow}>
              {status.state === "on" ? "On shift now" : status.state === "off" ? "Off now" : status.state === "rest" ? "Rest day" : "Annual leave"}
            </span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {cur ? cur.shiftType : status.next ? `Next: ${status.next.shiftType}` : `${myWatch} Watch`}
            </span>
            <span className="cal-mono" style={{ fontSize: 12 }}>
              {cur ? `${cur.startTime} → ${cur.endTime}${endsNextDay ? ` ${endDay}` : ""}` : status.nextLabel?.replace(`${status.next?.shiftType} `, "") ?? ""}
            </span>
          </div>
        </div>
      )}
      {status?.state === "on" && status.next && (
        <Row
          icon={shiftKind(status.next) === "night" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
          k={shiftKind(status.next) ?? "day"}
          title="Next shift"
          main={`${status.next.shiftType} · ${new Date(status.next.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`}
          sub={`${status.next.startTime} – ${status.next.endTime}`}
        />
      )}
      {nextEvent && (
        <Row
          icon={<Clock className="h-[18px] w-[18px]" />}
          k={nextEvent.calendar_visibility ?? "station"}
          title="Next event"
          main={nextEvent.title}
          sub={`${whenLabel(new Date(nextEvent.start_time), nextEvent.all_day)} · ${CAL_NAME[nextEvent.calendar_visibility] ?? "Calendar"}`}
        />
      )}
    </section>
  );
}

function Row({ icon, k, title, main, sub }: { icon: React.ReactNode; k: string; title: string; main: string; sub: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "0 4px" }}>
      <span style={{ width: 36, height: 36, borderRadius: 10, background: `var(--cal-${k}-bg)`, color: `var(--cal-${k}-fg)`, display: "grid", placeItems: "center", flex: "none" }}>
        {icon}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
        <span style={{ ...eyebrow, color: "var(--cal-muted)" }}>{title}</span>
        <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{main}</span>
        <span className="cal-mono" style={{ fontSize: 12, color: "var(--cal-ink-2)" }}>{sub}</span>
      </div>
    </div>
  );
}

// ─── Calendars ────────────────────────────────────────────────────────────────
function Toggle({
  on, colour, label, sub, lock, onClick, tall = true,
}: {
  on: boolean;
  colour: string;
  label: string;
  sub?: string;
  lock?: boolean;
  onClick: () => void;
  tall?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="cal-focus"
      style={{
        display: "flex", alignItems: "center", gap: 12, minHeight: tall ? 48 : 44, padding: "4px 8px", margin: "0 -8px",
        border: "none", background: "transparent", borderRadius: 12, color: "var(--cal-ink)", textAlign: "left", font: "inherit", cursor: "pointer",
      }}
    >
      <span
        style={{
          width: 20, height: 20, borderRadius: 6, flex: "none", display: "grid", placeItems: "center",
          background: on ? colour : "transparent", border: on ? "none" : `2px solid ${colour}`,
        }}
      >
        {on && <Check className="h-3 w-3" strokeWidth={3.5} color="#fff" />}
      </span>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: on ? "var(--cal-ink)" : "var(--cal-muted)" }}>{label}</span>
        {sub && <span style={{ fontSize: 12, color: "var(--cal-muted)" }}>{sub}</span>}
      </span>
      {lock && <Lock className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--cal-muted)" }} />}
    </button>
  );
}

function Calendars({
  visible, onToggle, watchShown, userWatch, isManager, onWatchChange,
}: {
  visible: Set<string>;
  onToggle: (key: string) => void;
  watchShown: string;
  userWatch: string;
  isManager: boolean;
  onWatchChange: (w: string) => void;
}) {
  const chip = (k: string): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 999,
    background: `var(--cal-${k}-bg)`, color: `var(--cal-${k}-fg)`, fontSize: 12, fontWeight: 500,
  });
  return (
    <section aria-label="Calendars" className="cal-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 6 }}>
      <h2 style={{ ...sectionTitle, marginBottom: 4 }}>My calendars</h2>
      <Toggle on={visible.has("station")} colour="var(--cal-station-dot)" label="Springburn Station" sub="Everyone" onClick={() => onToggle("station")} />
      <Toggle
        on={visible.has("watch")}
        colour="var(--cal-watch-dot)"
        label="Watch Calendar"
        sub={watchShown ? `${watchShown} Watch` : "Your watch"}
        onClick={() => onToggle("watch")}
      />
      {isManager && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "4px 0 8px 32px" }}>
          <label htmlFor="watchPick" style={{ fontSize: 12, color: "var(--cal-muted)" }}>Viewing watch</label>
          <select
            id="watchPick"
            value={watchShown}
            onChange={(e) => onWatchChange(e.target.value)}
            aria-label="Which watch's calendar to show"
            className="cal-field"
            style={{ height: 36, fontSize: 13 }}
          >
            {WATCHES.map((w) => (
              <option key={w} value={w}>{w}{w === userWatch ? " (yours)" : ""}</option>
            ))}
          </select>
        </div>
      )}
      <Toggle on={visible.has("personal")} colour="var(--cal-personal-dot)" label="Personal" sub="Only you" onClick={() => onToggle("personal")} />

      <div style={{ height: 1, background: "var(--cal-line)", margin: "4px 0 6px" }} />
      <h2 style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: "var(--cal-muted)", letterSpacing: ".04em", textTransform: "uppercase" }}>
        Overlays · read-only
      </h2>
      <Toggle tall={false} on={visible.has("tasks")} colour="var(--cal-tasks-dot)" label="Tasks" lock onClick={() => onToggle("tasks")} />
      <Toggle tall={false} on={visible.has("inspections")} colour="var(--cal-insp-dot)" label="Inspections" lock onClick={() => onToggle("inspections")} />

      {watchShown && (
        <>
          <Toggle tall={false} on={visible.has("shifts")} colour="var(--cal-ink-2)" label={`Shift rota · ${watchShown} Watch`} onClick={() => onToggle("shifts")} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 32 }}>
            <span style={chip("day")}><Sun className="h-3 w-3" />Day <span className="cal-mono">08–18</span></span>
            <span style={chip("night")}><Moon className="h-3 w-3" />Night <span className="cal-mono">18–08</span></span>
            <span style={chip("leave")}>Leave</span>
            <span style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 999, border: "1px dashed var(--cal-line-2)", color: "var(--cal-muted)", fontSize: 12, fontWeight: 500 }}>Rest</span>
          </div>
        </>
      )}
    </section>
  );
}

export interface CalendarSidePanelProps {
  currentDate: Date;
  view: CalendarViewType;
  onPickDay: (d: Date) => void;
  visible: Set<string>;
  onToggle: (key: string) => void;
  watchShown: string;
  userWatch: string;
  isManager: boolean;
  onWatchChange: (w: string) => void;
  upcoming: CalendarEvent[];
  /** The phone filter drawer already has a month grid on the page. */
  showMiniMonth?: boolean;
}

export default function CalendarSidePanel(props: CalendarSidePanelProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {props.showMiniMonth !== false && (
        <MiniMonth
          currentDate={props.currentDate}
          view={props.view}
          rotaWatch={props.visible.has("shifts") ? props.watchShown : undefined}
          onPickDay={props.onPickDay}
        />
      )}
      <NextUp myWatch={props.userWatch || undefined} upcoming={props.upcoming} />
      <Calendars
        visible={props.visible}
        onToggle={props.onToggle}
        watchShown={props.watchShown}
        userWatch={props.userWatch}
        isManager={props.isManager}
        onWatchChange={props.onWatchChange}
      />
    </div>
  );
}
