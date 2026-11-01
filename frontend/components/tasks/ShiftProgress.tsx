import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, History } from "lucide-react";

// One strip in place of the four count tiles (Nov 2026): work done this
// shift against the clock. The bar fills as cards are done; the tick marks
// how far through the shift we are — the same pace idea as the Targets cards.
// Colour only for problems: amber when well behind the clock.

interface Props {
  shift: { label: string; start: string; end: string; on_duty: boolean };
  stats: { todo: number; checks: number; carried: number; done: number };
  carriedOnly: boolean;
  onToggleCarried: () => void;
  compact?: boolean;
}

const hhmm = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function timeLeft(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${String(mins % 60).padStart(2, "0")}m left` : `${mins}m left`;
}

export default function ShiftProgress({ shift, stats, carriedOnly, onToggleCarried, compact }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const start = new Date(shift.start).getTime();
  const end = new Date(shift.end).getTime();
  const elapsed = shift.on_duty ? Math.min(1, Math.max(0, (now - start) / (end - start))) : 0;
  const total = stats.todo + stats.done;
  const done = total ? stats.done / total : 0;
  const allDone = total > 0 && stats.todo === 0;
  const behind = shift.on_duty && total > 0 && !allDone && elapsed >= 0.5 && done < elapsed - 0.25;
  const fill = allDone ? "var(--cal-leave-dot)" : behind ? "var(--cal-day-dot)" : "var(--cal-brand)";
  const when = shift.on_duty
    ? timeLeft(end - now)
    : `starts ${new Date(shift.start).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`;

  const chip = (k: string, children: React.ReactNode) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 26, padding: "0 9px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: `var(--cal-${k}-bg)`, color: `var(--cal-${k}-fg)` }}>
      {children}
    </span>
  );

  return (
    <section
      aria-label="This shift"
      className="cal-card"
      style={{ padding: compact ? "12px 14px" : "14px 18px", display: "flex", flexDirection: "column", gap: 10, borderRadius: 18 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: compact ? 12 : 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flex: "none" }}>
          <span className="cal-mono" style={{ fontSize: compact ? 22 : 26, fontWeight: 600, lineHeight: 1, letterSpacing: "-.02em" }}>
            {stats.done}<span style={{ color: "var(--cal-muted)" }}>/{total}</span>
          </span>
          <span style={{ fontSize: 13, color: "var(--cal-ink-2)" }}>done this shift</span>
        </div>

        <div
          role="progressbar"
          aria-label="Work done this shift"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={stats.done}
          style={{ position: "relative", flex: "1 1 160px", height: 10, borderRadius: 5, background: "var(--cal-surface-3)", minWidth: 120 }}
        >
          <div style={{ position: "absolute", inset: 0, width: `${Math.round(done * 100)}%`, borderRadius: 5, background: fill, transition: "width .3s ease-out" }} />
          {shift.on_duty && elapsed > 0 && elapsed < 1 && (
            <span
              title={`${Math.round(elapsed * 100)}% of the shift gone`}
              style={{ position: "absolute", top: -4, bottom: -4, left: `calc(${elapsed * 100}% - 1px)`, width: 2, borderRadius: 1, background: "var(--cal-ink)" }}
            />
          )}
        </div>

        <span className="cal-mono" style={{ fontSize: 12, color: "var(--cal-ink-2)", flex: "none" }}>
          {shift.label} {hhmm(new Date(shift.start))}–{hhmm(new Date(shift.end))} · {when}
        </span>
      </div>

      {(stats.checks > 0 || stats.carried > 0 || allDone || behind) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {allDone && chip("leave", <><CheckCircle2 className="h-3.5 w-3.5" /> Everything done</>)}
          {behind && chip("day", <><AlertTriangle className="h-3.5 w-3.5" /> Behind the clock</>)}
          {stats.checks > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 26, padding: "0 9px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "var(--cal-surface-2)", color: "var(--cal-ink-2)" }}>
              <ClipboardCheck className="h-3.5 w-3.5" /> {stats.checks} station check{stats.checks === 1 ? "" : "s"} to do
            </span>
          )}
          {stats.carried > 0 && (
            <button
              type="button"
              aria-pressed={carriedOnly}
              onClick={onToggleCarried}
              className="cal-focus"
              title={carriedOnly ? "Show everything" : "Show only what's carried over"}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5, height: 26, padding: "0 9px", borderRadius: 8, font: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: "var(--cal-day-bg)", color: "var(--cal-day-fg)", border: "none",
                boxShadow: carriedOnly ? "0 0 0 2px var(--cal-day-dot)" : undefined,
              }}
            >
              <History className="h-3.5 w-3.5" /> {stats.carried} carried over{carriedOnly ? " · showing" : ""}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
