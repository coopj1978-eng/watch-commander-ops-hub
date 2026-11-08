import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { useCanOpen } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { crewingShiftFor, getWatchShiftStatus, type ShiftDay } from "@/lib/shiftRota";
import { latestAbsencePerPerson, useTodaysAbsences } from "@/lib/absences";
import { ShiftWeather } from "@/components/home/ShiftWeather";
import {
  CalendarDays,
  ClipboardList,
  KanbanSquare,
  Moon,
  NotebookPen,
  Sun,
  Truck,
  UserRound,
  Palmtree,
  BedDouble,
  type LucideIcon,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────────
// ShiftHero — the "now" panel at the top of every home screen.
//
// One glance answers what a crew member asks walking into the station: is my
// watch on, how far through the shift are we, who's riding what, and where do
// I go next. Everything follows the watch's own rota (getWatchShiftStatus), so
// it matches the TopBar and crewing board. Re-renders every 30 s so the
// timeline and countdown stay live on a wall-mounted screen.
//
// Strength (who's sick / on leave) is only shown to WCs and CCs — firefighters
// only ever see their own absence records, so the numbers would be wrong.
// ──────────────────────────────────────────────────────────────────────────────

const MIN_CREW: Record<"b10p1" | "b10p2", number> = { b10p1: 5, b10p2: 4 };
const ROLE_ORDER = ["oic", "driver", "ba", "baeco", "ff"];
const ROLE_LABEL: Record<string, string> = {
  oic: "OIC", driver: "Driver", ba: "BA", baeco: "BA ECO", ff: "FF", detached: "Detached",
};

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function shiftBounds(s: ShiftDay) {
  const [y, m, d] = s.date.split("-").map(Number);
  const [h, min] = (s.startTime ?? "08:00").split(":").map(Number);
  const start = new Date(y, m - 1, d, h, min);
  const end = new Date(start.getTime() + (s.startTime === "18:00" ? 14 : 10) * 3_600_000);
  return { start, end };
}

function formatSpan(ms: number) {
  const mins = Math.max(0, Math.round(ms / 60_000));
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(m).padStart(2, "0")}m`;
  return `${m}m`;
}

const hhmm = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

// ── Shift timeline ────────────────────────────────────────────────────────────

function ShiftTimeline({ shift, now }: { shift: ShiftDay; now: Date }) {
  const { start, end } = shiftBounds(shift);
  const total = end.getTime() - start.getTime();
  const pct = Math.min(100, Math.max(0, ((now.getTime() - start.getTime()) / total) * 100));
  const hours = total / 3_600_000;
  const ticks = Array.from({ length: hours / 2 + 1 }, (_, i) => {
    const t = new Date(start.getTime() + i * 2 * 3_600_000);
    return { left: (i * 2 * 100) / hours, label: hhmm(t).slice(0, 2) };
  });

  return (
    <div className="mt-6">
      <div className="relative h-2 rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-white/25 via-[var(--hero-accent)] to-[var(--hero-accent)] transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-700"
          style={{ left: `${pct}%` }}
          aria-hidden
        >
          <span className="absolute inset-0 -m-1.5 rounded-full bg-[var(--hero-accent)] opacity-40 animate-ping" />
          <span className="relative block h-3.5 w-3.5 rounded-full bg-white ring-4 ring-[var(--hero-accent)]/40" />
        </div>
      </div>
      <div className="relative mt-2 h-4 font-mono text-[10px] text-white/40">
        {ticks.map((t, i) => (
          <span
            key={i}
            className={cn(
              "absolute -translate-x-1/2 tabular-nums",
              i !== 0 && i !== ticks.length - 1 && "hidden sm:inline",
              i === 0 && "translate-x-0",
              i === ticks.length - 1 && "-translate-x-full",
            )}
            style={{ left: `${t.left}%` }}
          >
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Riding board: one row per appliance, an initials chip per seat ──────────

function RidingBoard({
  entries,
  myId,
  loading,
}: {
  entries: { appliance: string; user_id?: string; user_name?: string; external_name?: string; crew_role: string }[];
  myId?: string;
  loading: boolean;
}) {
  return (
    <div className="space-y-3">
      {(["b10p1", "b10p2"] as const).map((app) => {
        const seats = entries
          .filter((e) => e.appliance === app)
          .sort((a, b) => ROLE_ORDER.indexOf(a.crew_role) - ROLE_ORDER.indexOf(b.crew_role));
        const target = MIN_CREW[app];
        const short = Math.max(0, target - seats.length);
        return (
          <div key={app} className="flex items-center gap-3">
            <div className="w-16 shrink-0">
              <div className="font-mono text-xs font-semibold tracking-wide text-white">{app.toUpperCase()}</div>
              <div
                className={cn(
                  "text-[10px] font-medium",
                  loading ? "text-white/40" : short === 0 ? "text-emerald-300" : seats.length === 0 ? "text-red-300" : "text-amber-300",
                )}
              >
                {loading ? "…" : short === 0 ? "Crewed" : seats.length === 0 ? "Not set" : `${short} short`}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {seats.map((s, i) => {
                const name = s.user_name || s.external_name || "Unknown";
                const mine = !!myId && s.user_id === myId;
                return (
                  <span
                    key={i}
                    title={`${name} · ${ROLE_LABEL[s.crew_role] ?? s.crew_role}`}
                    className={cn(
                      "relative grid h-8 w-8 place-items-center rounded-full text-[11px] font-semibold",
                      mine ? "bg-white text-neutral-900 ring-2 ring-[var(--hero-accent)]" : "bg-white/15 text-white",
                    )}
                  >
                    {initials(name)}
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-neutral-950 px-1 font-mono text-[8px] leading-3 text-white/70 ring-1 ring-white/10">
                      {ROLE_LABEL[s.crew_role] ?? s.crew_role}
                    </span>
                  </span>
                );
              })}
              {Array.from({ length: short }, (_, i) => (
                <span key={`gap-${i}`} className="h-8 w-8 rounded-full border border-dashed border-white/25" aria-hidden />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Quick actions ─────────────────────────────────────────────────────────────

interface QuickAction { label: string; to: string; Icon: LucideIcon }

const MANAGER_ACTIONS: QuickAction[] = [
  { label: "Crewing board", to: "/handover", Icon: Truck },
  { label: "Shift board", to: "/tasks", Icon: KanbanSquare },
  { label: "Handover", to: "/handover?tab=handover", Icon: NotebookPen },
  { label: "Calendar", to: "/calendar", Icon: CalendarDays },
];

const CREW_ACTIONS: QuickAction[] = [
  { label: "Shift board", to: "/tasks", Icon: KanbanSquare },
  { label: "Calendar", to: "/calendar", Icon: CalendarDays },
  { label: "Handover", to: "/handover?tab=handover", Icon: ClipboardList },
  { label: "My profile", to: "/profile", Icon: UserRound },
];

// ── Main panel ────────────────────────────────────────────────────────────────

export function ShiftHero() {
  const { user } = useAuth();
  const now = useNow();
  const watch = user?.watch_unit ?? "";
  const isManager = user?.role === "WC" || user?.role === "CC";
  const canOpen = useCanOpen();

  const status = watch ? getWatchShiftStatus(watch, now) : null;
  const crewShift = crewingShiftFor(watch, now);

  const crewingQ = useQuery({
    queryKey: ["wc-shift-crewing", watch, crewShift?.shiftDate ?? "", crewShift?.shiftType],
    queryFn: () =>
      backend.crewing.list({ watch, shift_date: crewShift!.shiftDate, shift_type: crewShift!.shiftType }),
    enabled: !!watch && !!crewShift,
    retry: false,
  });

  const statsQ = useQuery({
    queryKey: ["wc-crew-stats"],
    queryFn: async () => backend.crew.getStats(),
    enabled: isManager,
  });
  const absencesQ = useTodaysAbsences(isManager);

  const shown = status?.current ?? (status?.state === "off" ? status.next : undefined);
  const isNight = shown?.startTime === "18:00";
  const state = status?.state ?? "rest";

  const accent =
    state === "on" ? (isNight ? "#818cf8" : "#fbbf24")
    : state === "off" ? "#94a3b8"
    : state === "leave" ? "#34d399"
    : "#64748b";

  // Strength — same derivation as the crew table and staffing widget.
  const total = statsQ.data?.total_watch_members ?? 0;
  const memberIds = new Set(statsQ.data?.watch_member_ids ?? []);
  const absent = [...latestAbsencePerPerson(absencesQ.data?.absences ?? []).values()].filter((a) =>
    memberIds.has(a.firefighter_id),
  );
  const sick = absent.filter((a) => a.type === "sickness").length;
  const leave = absent.length - sick;
  const available = Math.max(0, total - absent.length);

  const entries = crewingQ.data?.entries ?? [];
  const mine = entries.find((e) => e.user_id && e.user_id === user?.id);

  const StateIcon = state === "leave" ? Palmtree : state === "rest" ? BedDouble : isNight ? Moon : Sun;
  const title =
    state === "on" || state === "off" ? shown?.shiftType ?? "Off now"
    : state === "leave" ? "Annual leave"
    : "Rest day";

  let countdown: string | null = null;
  if (state === "on" && status?.current) {
    countdown = `${formatSpan(shiftBounds(status.current).end.getTime() - now.getTime())} left`;
  } else if (status?.next) {
    countdown = `starts in ${formatSpan(shiftBounds(status.next).start.getTime() - now.getTime())}`;
  }

  // Only pages this person can open (firefighters' pages come on in phases).
  const actions = (isManager ? MANAGER_ACTIONS : CREW_ACTIONS).filter((a) => canOpen(a.to));
  const bounds = shown ? shiftBounds(shown) : null;
  const shiftWord = state === "on" ? "this shift" : "next shift";
  const dateLabel = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <section
      aria-label="Shift now"
      className="relative isolate overflow-hidden rounded-2xl bg-neutral-950 text-white ring-1 ring-white/10 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.6)] animate-in fade-in-0 slide-in-from-bottom-2 duration-500"
      style={{ ["--hero-accent" as string]: accent }}
    >
      {/* Control-room texture: a faint grid fading out from the top-left, and
          a glow in the shift's colour (amber days, indigo nights). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-32 -z-10 h-80 w-80 rounded-full blur-3xl opacity-30"
        style={{ background: accent }}
      />

      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-10">
        {/* ── Shift now ───────────────────────────────────────────────── */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-white/80 ring-1 ring-white/10">
              <span className="relative flex h-2 w-2">
                {state === "on" && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: accent }} />
                )}
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: accent }} />
              </span>
              {state === "on" ? "On duty" : state === "off" ? "Off now" : state === "leave" ? "On leave" : "Rest day"}
            </span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/50">
              {watch ? `${watch} Watch` : "No watch set"} · {dateLabel}
            </span>
          </div>

          <div className="mt-4 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h2 className="flex items-center gap-3 text-3xl font-semibold tracking-tight sm:text-5xl">
                <StateIcon className="h-7 w-7 shrink-0 sm:h-9 sm:w-9" style={{ color: accent }} aria-hidden />
                <span className="truncate">{title}</span>
              </h2>
              <p className="mt-2 font-mono text-sm text-white/60">
                {shown ? `${shown.startTime}–${shown.endTime}` : status?.nextLabel ? `Next: ${status.nextLabel}` : "No rota for this watch"}
                {countdown && <span className="text-white/90"> · {countdown}</span>}
              </p>
              {/* Phones: the weather as one line under the shift times. */}
              <ShiftWeather compact start={bounds?.start} end={bounds?.end} shiftWord={shiftWord} className="mt-1.5 sm:hidden" />
            </div>
            <div className="hidden items-start gap-3 sm:flex">
              <ShiftWeather start={bounds?.start} end={bounds?.end} shiftWord={shiftWord} />
              <span aria-hidden className="mt-2 h-12 w-px bg-white/10" />
              <div className="px-2 py-1 text-right">
                <div className="font-mono text-4xl font-medium tabular-nums tracking-tight text-white/90">{hhmm(now)}</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">UK time</div>
              </div>
            </div>
          </div>

          {state === "on" && status?.current ? (
            <ShiftTimeline shift={status.current} now={now} />
          ) : (
            status?.next && state !== "off" && (
              <p className="mt-5 text-sm text-white/60">
                Next shift <span className="font-medium text-white">{status.nextLabel}</span>
              </p>
            )
          )}

          {/* Quick actions */}
          <div className="-mx-1 mt-6 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {actions.map(({ label, to, Icon }) => (
              <Link
                key={label}
                to={to}
                className="group inline-flex shrink-0 items-center gap-2 rounded-lg bg-white/[0.07] px-3 py-2 text-sm font-medium text-white/90 ring-1 ring-white/10 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <Icon className="h-4 w-4 text-white/60 transition group-hover:text-white" />
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* ── Who's riding ─────────────────────────────────────────────── */}
        <div className="min-w-0 rounded-xl bg-white/[0.04] p-4 ring-1 ring-white/10 sm:p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-white/50">
              {crewShift?.upcoming ? `Riding · ${crewShift.shiftType}` : "Riding now"}
            </h3>
            {isManager && !!total && (
              <Link to="/people" className="text-xs text-white/60 hover:text-white">
                <span className="font-mono font-semibold text-white">{available}</span>/{total} available
                {sick > 0 && <span className="text-red-300"> · {sick} sick</span>}
                {leave > 0 && <span className="text-sky-300"> · {leave} leave</span>}
              </Link>
            )}
          </div>

          {crewShift ? (
            <>
              <div className="mt-4">
                <RidingBoard entries={entries} myId={user?.id} loading={crewingQ.isLoading} />
              </div>
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-sm">
                <span className="truncate text-white/70">
                  {mine
                    ? <>You: <span className="font-semibold text-white">{mine.appliance.toUpperCase()} · {ROLE_LABEL[mine.crew_role] ?? mine.crew_role}</span></>
                    : entries.length === 0
                    ? "Crewing not set for this shift"
                    : `${entries.length} crew assigned`}
                </span>
                {canOpen("/handover") && (
                  <Link to="/handover" className="shrink-0 font-medium text-white hover:underline">
                    {isManager ? (entries.length ? "Edit crewing →" : "Set crewing →") : "Crewing →"}
                  </Link>
                )}
              </div>
            </>
          ) : (
            <div className="mt-6 flex flex-col items-start gap-2 text-sm text-white/60">
              <StateIcon className="h-6 w-6" style={{ color: accent }} />
              <p>
                {state === "leave" ? `${watch} Watch is on annual leave.` : `${watch || "Your watch"} isn't on shift today.`}
                {status?.nextLabel && <> Back on <span className="text-white">{status.nextLabel}</span>.</>}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
