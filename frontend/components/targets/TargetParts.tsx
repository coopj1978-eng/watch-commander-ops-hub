import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ReferenceHolder } from "@/components/references/ReferenceHolder";
import { PACE_LABEL, type Pace, type PaceState } from "@/lib/quarters";

// Shared pieces for the Targets page cards: the progress ring with a pace
// marker, the status pill, and the card frame. Colour only shows a problem —
// neutral when on pace, amber behind, red late/missed, green done.

const RING_COLOUR: Record<PaceState, string> = {
  done: "text-emerald-500",
  ahead: "text-foreground",
  on: "text-foreground",
  behind: "text-amber-500",
  late: "text-red-500",
  missed: "text-red-500",
  upcoming: "text-muted-foreground/40",
  none: "text-muted-foreground/40",
};

const PILL: Record<PaceState, string> = {
  done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  ahead: "bg-muted text-foreground",
  on: "bg-muted text-foreground",
  behind: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  late: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  missed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  upcoming: "bg-muted text-muted-foreground",
  none: "bg-muted text-muted-foreground",
};

export const BAR_COLOUR: Record<PaceState, string> = {
  done: "bg-emerald-500",
  ahead: "bg-foreground/70",
  on: "bg-foreground/70",
  behind: "bg-amber-500",
  late: "bg-red-500",
  missed: "bg-red-500",
  upcoming: "bg-muted-foreground/30",
  none: "bg-muted-foreground/30",
};

export function PacePill({ state, label }: { state: PaceState; label?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold", PILL[state])}>
      {label ?? PACE_LABEL[state]}
    </span>
  );
}

/** A progress ring; the small tick marks where the count should be by today. */
export function TargetRing({
  actual, target, pace, size = 116, stroke = 10, children,
}: {
  actual: number; target: number; pace: Pace; size?: number; stroke?: number; children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(1, actual / target) : 0;
  const showTick = target > 0 && (pace.state === "behind" || pace.state === "late" || pace.state === "on" || pace.state === "ahead") && pace.expected > 0;
  const tickAngle = (Math.min(1, pace.expected / Math.max(1, target)) * 360 - 90) * (Math.PI / 180);
  const inner = r - stroke / 2 - 2;
  const outer = r + stroke / 2 + 2;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden className="block">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted-foreground/15" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={cn("transition-[stroke-dashoffset] duration-700 ease-out", RING_COLOUR[pace.state])}
        />
        {showTick && (
          <line
            x1={size / 2 + inner * Math.cos(tickAngle)} y1={size / 2 + inner * Math.sin(tickAngle)}
            x2={size / 2 + outer * Math.cos(tickAngle)} y2={size / 2 + outer * Math.sin(tickAngle)}
            stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="text-foreground/60"
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function TargetCard({
  icon, title, subtitle, pill, ring, children, footer, reference,
}: {
  icon: ReactNode; title: string; subtitle?: ReactNode; pill?: ReactNode; ring: ReactNode; children?: ReactNode; footer?: ReactNode;
  /** The station reference that covers this work — shows who holds it. */
  reference?: number;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-border/70 bg-card shadow-sm">
      <header className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-foreground/80">{icon}</span>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold leading-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
            {reference !== undefined && <ReferenceHolder refNo={reference} className="mt-1.5" />}
          </div>
        </div>
        <div className="shrink-0">{pill}</div>
      </header>
      <div className="flex flex-1 flex-col gap-5 p-4 sm:flex-row sm:items-start sm:p-5">
        {ring}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {footer && <footer className="flex flex-wrap items-center gap-2 border-t border-border/60 px-4 py-3 sm:px-5">{footer}</footer>}
    </section>
  );
}

/** "Should be 12 by today — 7 behind" / "31 to go · 17 Blue shifts left ≈ 2 a shift". */
export function PaceLines({
  pace, noun, shifts, watch,
}: { pace: Pace; noun: string; shifts: number | null; watch: string }) {
  const perShift = shifts && shifts > 0 && pace.remaining > 0 ? pace.remaining / shifts : null;
  return (
    <div className="space-y-1 text-sm">
      {(pace.state === "behind" || pace.state === "late") && (
        <p>
          <span className={pace.state === "late" ? "font-semibold text-red-600 dark:text-red-400" : "font-semibold text-amber-700 dark:text-amber-400"}>
            {pace.behindBy} behind
          </span>
          <span className="text-muted-foreground"> — should be {pace.expected} by today</span>
        </p>
      )}
      {(pace.state === "on" || pace.state === "ahead") && (
        <p className="text-muted-foreground">
          {pace.state === "ahead" ? "Ahead of" : "On"} pace — {pace.expected} expected by today
        </p>
      )}
      {pace.state === "missed" && <p className="font-semibold text-red-600 dark:text-red-400">Missed by {pace.behindBy}</p>}
      {pace.state === "done" && <p className="font-semibold text-emerald-700 dark:text-emerald-400">Target reached</p>}
      {pace.remaining > 0 && pace.state !== "missed" && (
        <p className="text-muted-foreground">
          <span className="font-mono tabular-nums text-foreground">{pace.remaining}</span> {noun} to go
          {shifts !== null && pace.state !== "upcoming" && (
            <>
              {" · "}
              <span className="font-mono tabular-nums text-foreground">{shifts}</span> {watch} shift{shifts === 1 ? "" : "s"} left
              {perShift !== null && (
                <span className="text-foreground"> ≈ {perShift < 1 ? "1 every " + Math.round(1 / perShift) + " shifts" : `${Math.ceil(perShift)} a shift`}</span>
              )}
            </>
          )}
        </p>
      )}
    </div>
  );
}
