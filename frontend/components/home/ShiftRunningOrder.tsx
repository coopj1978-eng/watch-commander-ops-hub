import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRightLeft, CalendarClock, CheckCircle2, ClipboardCheck, Flag, KanbanSquare, NotebookPen, Repeat,
} from "lucide-react";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import type { task } from "@/client";
import { cn } from "@/lib/utils";
import { getShiftForDate } from "@/lib/shiftRota";
import { STATION_WATCHES } from "@/components/targets/StationComparison";

// ──────────────────────────────────────────────────────────────────────────────
// The shift's running order (Nov 2026) — the home screen's main card, in the
// order the shift runs: parade, the routine and station checks, timed events
// from the calendar, the jobs on the board, the handover to read, and the
// handover to the next watch at the end. Before the shift starts, the checks
// are previewed from the weekly routine, so the watch knows what's coming.
// Replaces the This shift card, the last-handover strip, the scheduled
// today & tomorrow table and the mini calendar.
// Uses the same queries as the Tasks page, so opening it is instant.
// ──────────────────────────────────────────────────────────────────────────────

type Row = {
  key: string;
  at: number;         // ms — where it sits in the running order
  time: string | null; // shown in the left column
  Icon: typeof Flag;
  tone?: "done" | "warn";
  title: React.ReactNode;
  body?: React.ReactNode;
  to?: string;
};

const DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const hhmm = (d: Date | string) => new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function checklistOf(v: unknown): { label: string; done: boolean }[] {
  const arr = typeof v === "string" ? (() => { try { return JSON.parse(v); } catch { return []; } })() : v;
  return Array.isArray(arr) ? arr : [];
}

/** Which watch takes over when this shift ends — from the rota. */
function nextWatch(shift: task.ShiftInfo): string | null {
  const end = new Date(shift.end);
  const wantNight = shift.type === "day";
  for (const w of STATION_WATCHES) {
    const s = getShiftForDate(w, end);
    if (s?.isWorking && s.shiftType.includes(wantNight ? "Night" : "Day")) return w;
  }
  return null;
}

function Bar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:w-28">
        <span className={cn("block h-full rounded-full", done === total ? "bg-emerald-500" : "bg-foreground/70")} style={{ width: `${pct}%` }} />
      </span>
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{done}/{total}</span>
    </span>
  );
}

export function ShiftRunningOrder() {
  const { user } = useAuth();
  const watch = user?.watch_unit;

  const boardQ = useQuery({
    queryKey: ["tasks", "shift", "mine", watch],
    queryFn: () => backend.task.shiftBoard({ watch }),
    enabled: !!watch,
    refetchInterval: 60_000,
  });
  const notesQ = useQuery({
    queryKey: ["handover-notes", watch],
    queryFn: () => backend.handover.boardNotes({ watch: watch! }),
    enabled: !!watch,
    refetchInterval: 60_000,
  });
  const templatesQ = useQuery({
    queryKey: ["task-templates"],
    queryFn: async () => (await backend.task.listTemplates()).templates as unknown as task.TaskTemplate[],
    enabled: !!watch,
  });
  const shift = boardQ.data?.shift;
  const from = shift?.date;
  const to = shift ? new Date(shift.end).toISOString().slice(0, 10) : undefined;
  const eventsQ = useQuery({
    queryKey: ["schedule", from, to],
    queryFn: () => backend.schedule.list({ from, to }),
    enabled: !!from && !!to,
    refetchInterval: 5 * 60_000,
  });

  if (!watch) return null;

  const tasks = boardQ.data?.tasks ?? [];
  const doneCount = tasks.filter((t) => t.status === "Done").length;
  const start = shift ? new Date(shift.start).getTime() : 0;
  const end = shift ? new Date(shift.end).getTime() : 0;
  const now = Date.now();
  const rows: Row[] = [];

  if (shift) {
    rows.push({
      key: "parade", at: start, time: hhmm(shift.start), Icon: Flag,
      title: "Parade",
      body: <span>Riding positions and duties — <Link to="/handover" className="font-medium text-foreground hover:underline">crewing board</Link></span>,
    });

    // ── Station checks: the real cards, or a preview from the weekly routine.
    const checks = tasks.filter((t) => t.kind === "check");
    if (checks.length) {
      for (const t of checks) {
        const list = checklistOf(t.checklist);
        const d = list.filter((i) => i.done).length;
        rows.push({
          key: `check-${t.id}`, at: start + 1, time: null, Icon: ClipboardCheck, to: "/tasks",
          tone: t.status === "Done" ? "done" : undefined,
          title: t.title,
          body: list.length ? <Bar done={d} total={list.length} /> : t.status === "Done" ? "Done" : t.check_freq,
        });
      }
    } else if (!shift.on_duty) {
      const slot = `${DAYS[new Date(`${shift.date}T12:00:00`).getDay()]}-${shift.type}`;
      for (const t of (templatesQ.data ?? []).filter((t) => t.is_active && (t.routine_slot === "every" || t.routine_slot === slot))) {
        const items = checklistOf(t.checklist);
        rows.push({
          key: `preview-${t.id}`, at: start + 1, time: null, Icon: ClipboardCheck, to: "/tasks",
          title: <>{t.name} <span className="font-normal text-muted-foreground">· {items.length} check{items.length === 1 ? "" : "s"}</span></>,
          body: (
            <span className="flex flex-wrap gap-1">
              {items.slice(0, 4).map((i) => (
                <span key={i.label} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{i.label}</span>
              ))}
              {items.length > 4 && <span className="px-1 text-[11px] text-muted-foreground">+{items.length - 4} more</span>}
            </span>
          ),
        });
      }
    }

    // ── Timed events in the shift window.
    for (const e of eventsQ.data?.events ?? []) {
      const at = new Date(e.when).getTime();
      if (at < start || at >= end) continue;
      rows.push({
        key: `event-${e.id}`, at, time: hhmm(e.when), Icon: CalendarClock, to: e.link || "/calendar",
        tone: e.is_critical ? "warn" : undefined,
        title: e.what,
        body: [e.location, e.crew.length ? e.crew.map((c) => c.initials).join(" ") : null].filter(Boolean).join(" · ") || undefined,
      });
    }

    // ── Jobs on the board (watch tasks, handover jobs, calendar cards).
    const jobs = tasks.filter((t) => t.kind !== "check" && t.status !== "Done");
    if (jobs.length) {
      const carried = jobs.filter((t) => t.kind === "watch" && t.due_at && new Date(t.due_at).getTime() < start).length;
      rows.push({
        key: "jobs", at: start + 2, time: null, Icon: KanbanSquare, to: "/tasks",
        title: <>{jobs.length} job{jobs.length === 1 ? "" : "s"} on the board{carried > 0 && (
          <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400"><Repeat className="h-3 w-3" />{carried} carried over</span>
        )}</>,
        body: <span className="line-clamp-2">{jobs.slice(0, 4).map((t) => t.title).join(" · ")}{jobs.length > 4 ? ` · +${jobs.length - 4} more` : ""}</span>,
      });
    }

    // ── Handover to read.
    const notes = (notesQ.data?.notes ?? []).filter((n) => n.unread && n.items.some((i) => i.kind === "info"));
    if (notes.length) {
      const items = notes.flatMap((n) => n.items.filter((i) => i.kind === "info").map((i) => ({ ...i, from: n.from_watch })));
      rows.push({
        key: "handover-in", at: start + 3, time: null, Icon: NotebookPen, to: "/tasks",
        title: `Handover to read · ${items.length} from ${[...new Set(items.map((i) => i.from))].join(", ")} Watch`,
        body: <span className="line-clamp-2">{items.slice(0, 3).map((i) => i.text).join(" · ")}</span>,
      });
    }

    // ── Handover to the next watch.
    const next = nextWatch(shift);
    const minsLeft = Math.round((end - now) / 60_000);
    const due = shift.on_duty && minsLeft <= 60 && minsLeft > 0;
    rows.push({
      key: "handover-out", at: end, time: hhmm(shift.end), Icon: ArrowRightLeft, tone: due ? "warn" : undefined,
      title: next ? `Handover to ${next} Watch` : "Shift ends",
      body: (
        <span>
          {due && <span className="font-semibold text-amber-700 dark:text-amber-400">In {minsLeft}m — </span>}
          <Link to="/handover?tab=handover&new=1" className="font-medium text-foreground hover:underline">Write the handover</Link>
        </span>
      ),
    });
  }
  rows.sort((a, b) => a.at - b.at);

  const nowIndex = shift?.on_duty ? rows.findIndex((r) => r.time && r.at > now) : -1;
  const left = shift ? Math.max(0, end - now) : 0;
  const leftLabel = left >= 3_600_000 ? `${Math.floor(left / 3_600_000)}h ${String(Math.round((left % 3_600_000) / 60_000)).padStart(2, "0")}m left` : `${Math.round(left / 60_000)}m left`;

  return (
    <section aria-label="Running order" className="rounded-2xl border border-border/70 bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <div className="eyebrow">{shift?.on_duty ? "Running order · on now" : "Running order · next shift"}</div>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight">
            {shift ? `${shift.label}` : "Loading…"}
            {shift && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {shift.on_duty ? leftLabel : new Date(shift.start).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
              </span>
            )}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {tasks.length > 0 && <Bar done={doneCount} total={tasks.length} />}
          <Link to="/tasks" className="text-xs font-medium text-brand hover:underline">Shift board →</Link>
        </div>
      </header>

      {boardQ.isLoading ? (
        <div className="space-y-2 p-4 sm:p-5">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-11 animate-pulse rounded-lg bg-muted/60" />)}
        </div>
      ) : (
        <ol className="relative px-2 py-2 sm:px-3">
          {rows.map((r, i) => {
            const inner = (
              <>
                <span className="w-12 shrink-0 pt-0.5 text-right font-mono text-xs tabular-nums text-muted-foreground">{r.time ?? ""}</span>
                <span className="relative flex w-7 shrink-0 justify-center">
                  {i < rows.length - 1 && <span aria-hidden className="absolute bottom-[-14px] top-7 w-px bg-border" />}
                  <span className={cn(
                    "relative grid h-7 w-7 place-items-center rounded-full border",
                    r.tone === "done" ? "border-emerald-500 bg-emerald-500 text-white"
                      : r.tone === "warn" ? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                        : "border-border bg-background text-muted-foreground",
                  )}>
                    {r.tone === "done" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <r.Icon className="h-3.5 w-3.5" />}
                  </span>
                </span>
                <span className="min-w-0 flex-1 pb-1 pt-0.5">
                  <span className={cn("block text-sm font-medium", r.tone === "done" && "text-muted-foreground line-through")}>{r.title}</span>
                  {r.body && <span className="mt-1 block text-xs text-muted-foreground">{r.body}</span>}
                </span>
              </>
            );
            return (
              <li key={r.key}>
                {i === nowIndex && (
                  <div className="my-1 flex items-center gap-2 pl-[3.25rem]" aria-label="Now">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    <span className="h-px flex-1 bg-red-500/60" />
                    <span className="font-mono text-[10px] font-semibold text-red-600 dark:text-red-400">NOW {hhmm(new Date())}</span>
                  </div>
                )}
                {r.to ? (
                  <Link to={r.to} className="flex gap-2 rounded-xl px-1 py-2 transition-colors hover:bg-muted/50">{inner}</Link>
                ) : (
                  <div className="flex gap-2 px-1 py-2">{inner}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
