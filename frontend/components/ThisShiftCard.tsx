import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { cn } from "@/lib/utils";
import { CalendarClock, CheckCircle2, ClipboardCheck, Info, NotebookPen, Repeat, Users2 } from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────────
// ThisShiftCard — the shift board and the last watch's handover, in brief,
// on the home screen. Uses your own watch's current (or next) shift, the same
// query the Tasks page's "My watch" view uses, so opening Tasks is instant.
// ──────────────────────────────────────────────────────────────────────────────

const KIND: Record<string, { label: string; Icon: typeof Info; cls: string }> = {
  check:    { label: "Station check", Icon: ClipboardCheck, cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  handover: { label: "Handover",      Icon: NotebookPen,    cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  calendar: { label: "Calendar",      Icon: CalendarClock,  cls: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" },
  watch:    { label: "Watch task",    Icon: Users2,         cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
};

export function ThisShiftCard() {
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

  if (!watch) return null;

  const tasks = boardQ.data?.tasks ?? [];
  const open = tasks.filter((t) => t.status !== "Done");
  const done = tasks.length - open.length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const notes = (notesQ.data?.notes ?? []).filter((n) => n.unread && n.items.some((i) => i.kind === "info"));
  const shift = boardQ.data?.shift;

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      {/* ── Shift board ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/70 bg-card p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">On the board {shift && !shift.on_duty ? "next shift" : "this shift"}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{shift?.label ?? "Loading…"}</p>
          </div>
          <Link to="/tasks" className="text-xs font-medium text-brand hover:underline">Shift board →</Link>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{done}/{tasks.length} done</span>
        </div>

        {boardQ.isLoading ? (
          <div className="mt-4 space-y-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/60" />)}
          </div>
        ) : open.length === 0 ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            {tasks.length ? "Everything on the board is done." : "Nothing on the board yet."}
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-border/60">
            {open.slice(0, 6).map((t) => {
              const k = KIND[t.kind] ?? KIND.watch;
              const carried = t.kind === "watch" && t.due_at && shift && new Date(t.due_at) < new Date(shift.start);
              return (
                <li key={t.id}>
                  <Link to="/tasks" className="flex items-center gap-3 py-2.5 hover:text-primary">
                    <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md", k.cls)} title={k.label}>
                      <k.Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                    {t.check_freq && (
                      <span className="hidden shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
                        {t.check_freq}
                      </span>
                    )}
                    {carried && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                        <Repeat className="h-3 w-3" /> Carried
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
            {open.length > 6 && (
              <li className="pt-2.5 text-xs text-muted-foreground">
                <Link to="/tasks" className="hover:text-primary">+{open.length - 6} more on the board</Link>
              </li>
            )}
          </ul>
        )}
      </div>

      {/* ── From the last watch ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/70 bg-card p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold">Handover for {watch} Watch</h3>
          <Link to="/handover?tab=handover" className="text-xs font-medium text-brand hover:underline">All notes →</Link>
        </div>
        {notes.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No unread handover notes.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {notes.slice(0, 2).map((n) => (
              <div key={n.handover_id} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                  From {n.from_watch} · {n.shift_type}
                  {n.written_by_name ? ` · ${n.written_by_name}` : ""}
                </div>
                <ul className="mt-2 space-y-1.5">
                  {n.items.filter((i) => i.kind === "info").slice(0, 4).map((i, idx) => (
                    <li key={i.id ?? idx} className="flex gap-2 text-sm">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
                      <span className="min-w-0">{i.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <Link to="/tasks" className="block text-xs text-muted-foreground hover:text-primary">
              Mark them read on the shift board →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
