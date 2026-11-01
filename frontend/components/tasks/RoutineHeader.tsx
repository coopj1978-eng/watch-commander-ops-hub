import { Moon } from "lucide-react";
import { DAY_NAMES, ruleLabel } from "@/lib/routineRules";

// The header on a routine card (Nov 2026). John's Trello cards carry picture
// headers — "Monday" in big letters on a coloured background — so the crew
// can tell the days and the weekly / monthly cards apart at a glance. The app
// draws them: each day has its own colours, monthly cards add stripes and
// quarterly ones dots, and the label says which week it's for. A card with
// its own picture or colour (set in the planner) shows that instead.

const DAY_COLOURS: Record<string, [string, string]> = {
  MO: ["#ea580c", "#f59e0b"],
  TU: ["#15803d", "#84cc16"],
  WE: ["#0369a1", "#22d3ee"],
  TH: ["#6d28d9", "#d946ef"],
  FR: ["#be123c", "#fb7185"],
  SA: ["#0f766e", "#2dd4bf"],
  SU: ["#3730a3", "#818cf8"],
  every: ["#1e293b", "#475569"],
};

const PATTERN: Record<string, string> = {
  // Facets, a nod to the low-poly backgrounds on the Trello headers.
  weekly: "linear-gradient(115deg, rgba(255,255,255,.18) 0 28%, rgba(255,255,255,0) 28% 56%, rgba(0,0,0,.10) 56% 78%, rgba(255,255,255,.06) 78%)",
  first: "repeating-linear-gradient(135deg, rgba(255,255,255,.16) 0 9px, rgba(255,255,255,0) 9px 18px)",
  last: "repeating-linear-gradient(135deg, rgba(255,255,255,.16) 0 9px, rgba(255,255,255,0) 9px 18px)",
  "quarter-last": "radial-gradient(rgba(255,255,255,.32) 1.6px, rgba(255,255,255,0) 1.8px) 0 0 / 12px 12px",
};

export function RoutineHeader({
  slot, rule, name, height = 72, radius = 11,
}: {
  /** 'every' or e.g. 'MO-day' / 'MO-night'. */
  slot: string;
  rule?: string | null;
  /** The card's name — the big text on every-shift cards. */
  name?: string;
  height?: number;
  radius?: number;
}) {
  const every = slot === "every";
  const [dayKey, shift] = every ? ["every", null] : slot.split("-");
  const [a, b] = DAY_COLOURS[dayKey] ?? DAY_COLOURS.every;
  const night = shift === "night";
  const big = every ? (name ?? "Every shift").replace(/^Start of shift\s*[–-]\s*/i, "") : `${DAY_NAMES[dayKey] ?? ""}${night ? " night" : ""}`;
  const small = every ? "Every shift" : ruleLabel(rule, dayKey, height < 60);
  const compact = height < 60;

  return (
    <div
      aria-hidden
      style={{
        position: "relative", height, borderRadius: radius, overflow: "hidden", flex: "none",
        background: `${PATTERN[rule ?? "weekly"] ?? PATTERN.weekly}, linear-gradient(135deg, ${a}, ${b})`,
        color: "#fff", display: "flex", flexDirection: "column", justifyContent: "flex-end",
        padding: compact ? "6px 10px" : "8px 12px",
      }}
    >
      {night && <div style={{ position: "absolute", inset: 0, background: "rgba(2,6,23,.38)" }} />}
      {night && <Moon className="h-4 w-4" style={{ position: "absolute", top: 8, right: 10, opacity: 0.85 }} />}
      <span
        className="cal-mono"
        style={{
          position: "relative", alignSelf: "flex-start", fontSize: compact ? 9 : 10, fontWeight: 700, letterSpacing: ".1em",
          textTransform: "uppercase", padding: "2px 6px", borderRadius: 5, background: "rgba(0,0,0,.28)", marginBottom: compact ? 2 : 4,
        }}
      >
        {small}
      </span>
      <span
        style={{
          position: "relative", fontSize: compact ? 17 : 26, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.05,
          textShadow: "0 1px 2px rgba(0,0,0,.25)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}
      >
        {big}
      </span>
    </div>
  );
}
