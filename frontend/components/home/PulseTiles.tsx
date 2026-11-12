import type { CSSProperties, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import backend from "@/lib/backend";
import { useAuth } from "@/App";
import { cn } from "@/lib/utils";
import { latestAbsencePerPerson, localTodayIso, useTodaysAbsences } from "@/lib/absences";
import { useBoardDefects } from "@/components/J4Board";
import { boardGroups, outstanding } from "@/lib/j4Board";
import { barHeight, boardProgress, missedByDay, shortName } from "@/lib/pulse";
import { useCountUp } from "@/lib/useCountUp";
import { useCanOpen } from "@/lib/navigation";
import { HFSV_TARGET_Q } from "@/lib/targets";
import { currentFyQuarter, pace, quarterTime } from "@/lib/quarters";

// ──────────────────────────────────────────────────────────────────────────────
// PulseTiles — four "at a glance" tiles under the shift panel (Nov 2026).
// John: Home was stretched and half empty on a wide screen; he wanted more on
// it, in the style of a bento dashboard. Each tile is one number a Watch
// Commander checks at the start of a shift, a small drawing of what's behind
// it, and a tap through to the page. Colour only when something's wrong.
//
// Every tile reads a query another card on Home already makes (same keys), so
// they cost no extra requests.
//
// Watch and Crew Commanders get crew, missed checks, the J4 board and the
// shift board. Firefighters get the shift board, the J4 board, the watch's
// home fire safety visits and their own TOIL — never who's off or what was
// missed, which are a manager's to see — and only for pages switched on.
// ──────────────────────────────────────────────────────────────────────────────

type Tone = "ok" | "warn" | "bad" | "quiet";

const TONE_TEXT: Record<Tone, string> = {
  ok: "text-muted-foreground",
  quiet: "text-muted-foreground",
  warn: "font-medium text-amber-700 dark:text-amber-400",
  bad: "font-medium text-red-700 dark:text-red-400",
};

function Tile({
  to, label, value, word, unit, note, tone = "quiet", loading, children, index,
}: {
  to: string;
  label: string;
  /** The big number; null while loading. */
  value: number | null;
  /** A word in place of the number, when a number would say nothing ("Clear"). */
  word?: string;
  /** What follows it: "/10", "missed". */
  unit?: string;
  note: string;
  tone?: Tone;
  loading?: boolean;
  children: ReactNode;
  index: number;
}) {
  const shown = useCountUp(value ?? 0);
  return (
    <Link
      to={to}
      style={{ "--i": index } as CSSProperties}
      className="bento-item group relative flex min-h-[9.5rem] min-w-0 flex-col rounded-2xl border border-border/70 bg-card p-4 transition-[border-color,box-shadow] duration-200 hover:border-foreground/25 hover:shadow-[0_6px_24px_-12px_rgb(0_0_0/0.25)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[13px] font-medium text-muted-foreground">{label}</h3>
        <span
          aria-hidden
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border/80 text-muted-foreground transition-[background-color,color,border-color,transform] duration-200 group-hover:rotate-45 group-hover:border-foreground group-hover:bg-foreground group-hover:text-background"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>

      <p className="mt-1 flex items-baseline gap-1.5">
        <span className={cn("text-[2.5rem] font-semibold leading-none tracking-tight tabular-nums", loading && "text-muted-foreground/40")}>
          {loading ? "–" : word ?? shown}
        </span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </p>

      <div className="mt-auto pt-3">{children}</div>
      <p className={cn("mt-2 truncate text-xs", TONE_TEXT[tone])}>{note}</p>
    </Link>
  );
}

// ── Crew: one dot per person on the watch ────────────────────────────────────

function CrewTile({ index }: { index: number }) {
  const { user } = useAuth();
  const watch = user?.watch_unit ?? "";
  const roster = useQuery({
    queryKey: ["crewing-roster", watch],
    queryFn: async () => backend.crewing.roster({ watch }),
    enabled: !!watch,
  });
  const absences = useTodaysAbsences(true);

  const members = roster.data?.members ?? [];
  const ids = new Set(members.map((m) => m.id));
  const off = new Map(
    [...latestAbsencePerPerson(absences.data?.absences ?? []).values()]
      .filter((a) => ids.has(a.firefighter_id))
      .map((a) => [a.firefighter_id, a.type] as const),
  );
  const available = members.length - off.size;
  const sick = [...off.values()].filter((t) => t === "sickness").length;
  const offNames = members.filter((m) => off.has(m.id)).map((m) => shortName(m.name));
  const loading = roster.isLoading || absences.isLoading;

  return (
    <Tile
      index={index}
      to="/people"
      label="Crew available"
      value={loading ? null : available}
      unit={`of ${members.length}`}
      loading={loading}
      tone={sick > 0 ? "bad" : off.size > 0 ? "warn" : "ok"}
      note={
        loading ? "Loading the watch…"
          : off.size === 0 ? "Everyone's available"
            : `${offNames.slice(0, 2).join(", ")}${offNames.length > 2 ? ` +${offNames.length - 2}` : ""} off${sick > 0 ? ` · ${sick} sick` : ""}`
      }
    >
      <div className="flex flex-wrap gap-1.5" role="img" aria-label={`${available} of ${members.length} available`}>
        {members.map((m, i) => {
          const type = off.get(m.id);
          return (
            <span
              key={m.id}
              title={`${m.name}${type ? (type === "sickness" ? " · off sick" : " · off") : ""}`}
              style={{ "--i": i } as CSSProperties}
              className={cn(
                "viz-dot h-3.5 w-3.5 rounded-full",
                !type && "bg-foreground/80",
                type === "sickness" && "border-2 border-red-500 bg-red-500/15",
                type && type !== "sickness" && "border-2 border-amber-500 bg-amber-500/15",
              )}
            />
          );
        })}
        {loading && Array.from({ length: 10 }, (_, i) => <span key={i} className="h-3.5 w-3.5 rounded-full bg-muted" />)}
      </div>
    </Tile>
  );
}

// ── Station checks: missed, day by day, for the last week ────────────────────

function ChecksTile({ index }: { index: number }) {
  const { user } = useAuth();
  const watch = (user?.watch_unit ?? "").toLowerCase();
  const q = useQuery({
    queryKey: ["missed-checks"],
    queryFn: () => backend.task.missedChecks({ days: 7 }),
  });
  // The same count as Needs you: checks missed on this watch's shifts, plus
  // the station's weekly-and-longer ones (whoever was on).
  const missed = (q.data?.checks ?? []).filter(
    (c) => c.watches.length === 0 || c.watches.some((w) => w.toLowerCase() === watch),
  );
  const bars = missedByDay(missed, localTodayIso());
  const max = Math.max(0, ...bars.map((b) => b.missed));

  return (
    <Tile
      index={index}
      to="/tasks"
      label="Station checks missed"
      value={q.isLoading ? null : missed.length}
      unit="in 7 days"
      loading={q.isLoading}
      tone={missed.length > 0 ? "warn" : "ok"}
      note={q.isLoading ? "Loading the week…" : missed.length === 0 ? "Every check done this week" : `Worst day: ${bars.reduce((a, b) => (b.missed > a.missed ? b : a)).missed} missed`}
    >
      <div className="flex h-10 items-end gap-1.5" role="img" aria-label={bars.map((b) => `${b.date}: ${b.missed} missed`).join(", ")}>
        {bars.map((b, i) => (
          <div key={b.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${b.date}: ${b.missed} missed`}>
            <span
              style={{ "--i": i, height: `${barHeight(b.missed, max) * 100}%` } as CSSProperties}
              className={cn(
                "viz-bar w-full max-w-7 rounded-full",
                b.missed > 0 ? "bg-amber-500" : "bg-muted-foreground/20",
                b.today && "outline outline-1 outline-offset-2 outline-foreground/30",
              )}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5" aria-hidden>
        {bars.map((b) => (
          <span key={b.date} className={cn("min-w-0 flex-1 text-center text-[10px]", b.today ? "font-semibold text-foreground" : "text-muted-foreground")}>{b.letter}</span>
        ))}
      </div>
    </Tile>
  );
}

// ── J4 board: what's missing or defective, by appliance ──────────────────────

function J4Tile({ index }: { index: number }) {
  const defects = useBoardDefects();
  const appliances = useQuery({
    queryKey: ["appliances"],
    queryFn: () => backend.appliance.listAppliances({}),
  });
  const onBoard = (defects.data ?? []).filter(outstanding);
  const groups = boardGroups(appliances.data?.appliances ?? [], onBoard);
  const overdue = onBoard.filter((d) => d.overdue).length;
  const max = Math.max(1, ...groups.map((g) => g.lines.length));
  const loading = defects.isLoading || appliances.isLoading;

  return (
    <Tile
      index={index}
      to="/equipment"
      label="J4 board"
      value={loading ? null : onBoard.length}
      unit="missing or defective"
      loading={loading}
      tone={overdue > 0 ? "bad" : onBoard.length > 0 ? "warn" : "ok"}
      note={loading ? "Loading the board…" : onBoard.length === 0 ? "All kit accounted for" : overdue > 0 ? `${overdue} over 30 days` : "None over 30 days"}
    >
      <ul className="space-y-1.5">
        {groups.slice(0, 4).map((g, i) => (
          <li key={g.key} className="flex items-center gap-2 text-[11px]">
            <span className="w-11 shrink-0 font-mono text-muted-foreground">{g.heading === "Station" ? "STN" : g.heading}</span>
            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                style={{ "--i": i, width: `${(g.lines.length / max) * 100}%` } as CSSProperties}
                className={cn("viz-seg block h-full rounded-full", g.lines.length > 0 ? "bg-amber-500" : "bg-transparent")}
              />
            </span>
            <span className="w-4 shrink-0 text-right font-mono tabular-nums">{g.lines.length}</span>
          </li>
        ))}
      </ul>
    </Tile>
  );
}

// ── Shift board: how far through the shift's cards ───────────────────────────

function BoardTile({ index }: { index: number }) {
  const { user } = useAuth();
  const watch = user?.watch_unit;
  const q = useQuery({
    queryKey: ["tasks", "shift", "mine", watch],
    queryFn: () => backend.task.shiftBoard({ watch }),
    enabled: !!watch,
  });
  const tasks = q.data?.tasks ?? [];
  const p = boardProgress(tasks);
  const left = p.total - p.done;

  return (
    <Tile
      index={index}
      to="/tasks"
      label="Shift board"
      value={q.isLoading ? null : p.done}
      word={!q.isLoading && p.total === 0 ? "Clear" : undefined}
      unit={p.total === 0 ? undefined : `of ${p.total} cards done`}
      loading={q.isLoading}
      tone="quiet"
      note={q.isLoading ? "Loading the board…" : p.total === 0 ? "Cards arrive when your shift starts" : left === 0 ? "Every card done" : `${left} to go${p.started ? ` · ${p.started} started` : ""}`}
    >
      <div className="flex gap-1" role="img" aria-label={`${p.done} of ${p.total} cards done`}>
        {p.total === 0 ? (
          <span className="h-2 flex-1 rounded-full bg-muted" />
        ) : (
          tasks.slice(0, 24).map((t, i) => (
            <span
              key={t.id}
              title={`${t.title} · ${t.status === "Done" ? "done" : t.status === "InProgress" ? "started" : "to do"}`}
              style={{ "--i": i } as CSSProperties}
              className={cn(
                "viz-dot h-2 min-w-1.5 flex-1 rounded-full",
                t.status === "Done" ? "bg-foreground/80" : t.status === "InProgress" ? "bg-foreground/35" : "bg-muted-foreground/20",
              )}
            />
          ))
        )}
      </div>
    </Tile>
  );
}

// ── Home fire safety visits: the watch's quarter so far (firefighters) ───────

function HfsvTile({ index }: { index: number }) {
  const { user } = useAuth();
  const watch = user?.watch_unit ?? "";
  const fq = currentFyQuarter();
  const t = quarterTime(fq);
  const q = useQuery({
    queryKey: ["activities", "hfsv", watch, fq.fy, fq.q],
    queryFn: () => backend.activity.list({ type: "hfsv", watch, financial_year: fq.fy, quarter: fq.q }),
    enabled: !!watch,
  });
  const done = q.data?.total_completed ?? 0;
  const p = pace(done, HFSV_TARGET_Q, t.elapsed, t.phase);
  const behind = p.state === "behind" || p.state === "late" || p.state === "missed";
  const share = Math.min(1, done / HFSV_TARGET_Q);

  return (
    <Tile
      index={index}
      to="/targets"
      label="Home fire safety visits"
      value={q.isLoading ? null : done}
      unit={`of ${HFSV_TARGET_Q} this quarter`}
      loading={q.isLoading}
      tone={behind ? "warn" : "ok"}
      note={q.isLoading ? "Loading the quarter…" : p.state === "done" ? "Target met" : behind ? `${p.behindBy} behind where we should be` : `${p.remaining} to go · on pace`}
    >
      <div className="relative h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${done} of ${HFSV_TARGET_Q} visits`}>
        <span
          style={{ "--i": 0, width: `${share * 100}%` } as CSSProperties}
          className={cn("viz-seg block h-full rounded-full", behind ? "bg-amber-500" : "bg-foreground/80")}
        />
        {/* Where the count should be by today. */}
        {t.phase === "now" && (
          <span aria-hidden className="absolute inset-y-0 w-0.5 bg-foreground/50" style={{ left: `${Math.min(1, t.elapsed) * 100}%` }} />
        )}
      </div>
    </Tile>
  );
}

// ── Your own TOIL (firefighters) ─────────────────────────────────────────────

function ToilTile({ index }: { index: number }) {
  const { user } = useAuth();
  const year = new Date().getFullYear();
  const q = useQuery({
    queryKey: ["toil-balance", user?.id, year],
    queryFn: () => backend.toil.balance({ user_id: user!.id, year }),
    enabled: !!user?.id,
  });
  const mine = q.data?.balances?.[0];
  const balance = mine?.balance ?? 0;
  const earned = mine?.total_earned ?? 0;
  const pending = mine?.pending_earned ?? 0;
  const share = earned > 0 ? Math.min(1, Math.max(0, balance / earned)) : 0;

  return (
    <Tile
      index={index}
      to="/profile?tab=hours"
      label="My TOIL"
      value={q.isLoading ? null : balance}
      unit="hours to take"
      loading={q.isLoading}
      tone="quiet"
      note={q.isLoading ? "Loading your hours…" : pending > 0 ? `${pending}h waiting to be approved` : earned > 0 ? `${earned}h earned in ${year}` : "Nothing banked yet"}
    >
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${balance} of ${earned} hours left`}>
        <span style={{ "--i": 0, width: `${share * 100}%` } as CSSProperties} className="viz-seg block h-full rounded-full bg-foreground/80" />
      </div>
    </Tile>
  );
}

export function PulseTiles({ audience = "managers" }: { audience?: "managers" | "crew" }) {
  const canOpen = useCanOpen();

  if (audience === "managers") {
    return (
      <section aria-label="At a glance" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <CrewTile index={0} />
        <ChecksTile index={1} />
        <J4Tile index={2} />
        <BoardTile index={3} />
      </section>
    );
  }

  // Firefighters: only the tiles whose page is switched on for them.
  const tiles: { key: string; Tile: (p: { index: number }) => ReactNode }[] = [
    ...(canOpen("/tasks") ? [{ key: "board", Tile: BoardTile }] : []),
    ...(canOpen("/equipment") ? [{ key: "j4", Tile: J4Tile }] : []),
    ...(canOpen("/targets") ? [{ key: "hfsv", Tile: HfsvTile }] : []),
    { key: "toil", Tile: ToilTile },
  ];

  return (
    <section aria-label="At a glance" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {tiles.map(({ key, Tile: T }, i) => <T key={key} index={i} />)}
    </section>
  );
}
