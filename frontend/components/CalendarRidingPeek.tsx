import { ArrowRight, Users, X } from "lucide-react";
import type { crewing } from "@/client";
import { ridingLevel } from "./CalendarWidget";

// Tap a shift's riding count on the calendar (Nov 2026): who's away and why,
// who's coming in to cover, and a way to that shift's crewing board.

const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

const section: React.CSSProperties = {
  margin: "0 0 6px", fontSize: 11.5, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--cal-muted)",
};

function Row({ name, why }: { name?: string; why: string }) {
  return (
    <li style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 13.5, padding: "5px 0" }}>
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: name ? "var(--cal-ink)" : "var(--cal-muted)" }}>
        {name || "Someone on the watch"}
      </span>
      <span style={{ flex: "none", fontSize: 11.5, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "var(--cal-surface-2)", color: "var(--cal-ink-2)" }}>
        {why}
      </span>
    </li>
  );
}

export default function CalendarRidingPeek({
  shift, watch, rideOne, rideBoth, style, onClose, onOpenBoard,
}: {
  shift: crewing.ShiftStrength;
  watch: string;
  rideOne: number;
  rideBoth: number;
  style: React.CSSProperties;
  onClose: () => void;
  onOpenBoard: () => void;
}) {
  const level = ridingLevel(shift, rideOne, rideBoth);
  const night = shift.shift_type.includes("Night");
  const status =
    level === "crit" ? { text: `Not enough to ride a pump — B10P1 needs ${rideOne}.`, bg: "var(--cal-crit-bg)", fg: "var(--cal-crit-fg)" }
    : level === "short" ? { text: `${rideBoth - shift.available} short to ride both pumps (needs ${rideBoth}).`, bg: "var(--cal-short-bg)", fg: "var(--cal-short-fg)" }
    : { text: `Enough to ride both pumps (needs ${rideBoth}).`, bg: "var(--cal-surface-2)", fg: "var(--cal-ink-2)" };

  return (
    <div role="dialog" aria-modal="true" aria-label={`${watch} Watch ${shift.shift_type} riding`} style={{ ...style, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ width: 12, height: 12, borderRadius: 4, marginTop: 6, flex: "none", background: `var(--cal-${night ? "night" : "day"}-dot)` }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 11.5, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--cal-muted)" }}>
            {watch} Watch · {shift.shift_type}
          </p>
          <h2 style={{ margin: "4px 0 0", fontSize: 19, lineHeight: 1.25, fontWeight: 650, letterSpacing: "-.01em", display: "flex", alignItems: "center", gap: 8 }}>
            <Users className="h-5 w-5" aria-hidden /> {shift.available} of {shift.total} available
          </h2>
          <p className="cal-mono" style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--cal-ink-2)" }}>
            {dayLabel(shift.date)} · {night ? "18:00–08:00" : "08:00–18:00"}
          </p>
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

      <div style={{ borderRadius: 12, padding: "10px 12px", fontSize: 13, fontWeight: 600, background: status.bg, color: status.fg }}>
        {status.text}
      </div>

      <div>
        <p style={section}>Away · {shift.away.length}</p>
        {shift.away.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--cal-muted)" }}>Nobody booked off.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {shift.away.map((a, i) => <Row key={i} name={a.name} why={a.why} />)}
          </ul>
        )}
      </div>

      {shift.covers.length > 0 && (
        <div>
          <p style={section}>Coming in · {shift.covers.length}</p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {shift.covers.map((c, i) => <Row key={i} name={c.name} why={c.why} />)}
          </ul>
        </div>
      )}

      <p style={{ margin: 0, fontSize: 12, color: "var(--cal-muted)" }}>
        From sickness, leave and shift bookings. It doesn't check skills (OIC, drivers, BA) — the crewing board does.
      </p>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onOpenBoard}
          className="cal-focus"
          style={{
            height: 40, padding: "0 16px", borderRadius: 12, border: "none", background: "var(--cal-brand)", color: "#fff",
            font: "inherit", fontSize: 14, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
          }}
        >
          <ArrowRight className="h-4 w-4" /> Open crewing board
        </button>
      </div>
    </div>
  );
}
