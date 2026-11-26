import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarClock, Check, ChefHat, ChevronRight, ClipboardCheck, KanbanSquare, type LucideIcon } from "lucide-react";
import backend from "@/lib/backend";
import type { crewing, task } from "@/client";
import { useCanOpen } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { shiftToday, todayLeft, type TodayItem, type TodayKind } from "@/lib/shiftToday";

// The short "this shift" list in the Home hero (John, 26 Nov 2026): the
// routine cards, timed jobs and calendar events, the jobs on the board and
// who's on canteen — one line each, each opening its own page. No detail
// here on purpose; the running order further down Home has that. Uses the
// same queries as the running order and the Tasks page, so it costs nothing
// extra to load.

const ICON: Record<TodayKind, LucideIcon> = { check: ClipboardCheck, event: CalendarClock, jobs: KanbanSquare, canteen: ChefHat };
/** More than this and the rest fold into "+N more". */
const MAX_ROWS = 7;

function Row({ item, accent, canOpen }: { item: TodayItem; accent: string; canOpen: (to: string) => boolean }) {
  const Icon = ICON[item.kind];
  const inner = (
    <>
      {/* Left: the time for something timed, else what kind of thing it is. */}
      <span className="flex w-11 shrink-0 items-center justify-start">
        {item.done ? (
          <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500/90 text-neutral-950">
            <Check className="h-3 w-3" strokeWidth={3.2} aria-hidden />
          </span>
        ) : item.time ? (
          <span className="font-mono text-[13px] font-medium tabular-nums" style={{ color: accent }}>{item.time}</span>
        ) : (
          <Icon className="h-[18px] w-[18px] text-white/50" aria-hidden />
        )}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[15px] leading-tight sm:text-sm",
          item.done ? "text-white/45 line-through" : item.empty ? "text-white/60" : "font-medium text-white",
        )}
      >
        {item.label}
        {item.done && <span className="sr-only"> (done)</span>}
      </span>
      {item.note && <span className="shrink-0 font-mono text-xs tabular-nums text-white/50">{item.note}</span>}
    </>
  );
  const base = "flex min-h-11 items-center gap-2.5 px-3.5 py-2 sm:min-h-10";
  return (
    <li>
      {canOpen(item.to.split("?")[0]) ? (
        <Link
          to={item.to}
          className={cn(base, "group transition-colors hover:bg-white/[0.06] focus-visible:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40")}
        >
          {inner}
          <ChevronRight className="h-4 w-4 shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-white/60" aria-hidden />
        </Link>
      ) : (
        <div className={base}>{inner}</div>
      )}
    </li>
  );
}

export function HeroToday({ watch, accent }: { watch: string; accent: string }) {
  const canOpen = useCanOpen();
  const boardQ = useQuery({
    queryKey: ["tasks", "shift", "mine", watch],
    queryFn: () => backend.task.shiftBoard({ watch }),
    enabled: !!watch,
    refetchInterval: 60_000,
  });
  const shift = boardQ.data?.shift;
  const templatesQ = useQuery({
    queryKey: ["task-templates"],
    queryFn: async () => (await backend.task.listTemplates()).templates as unknown as task.TaskTemplate[],
    enabled: !!watch,
  });
  const from = shift?.date;
  const to = shift ? new Date(shift.end).toISOString().slice(0, 10) : undefined;
  const eventsQ = useQuery({
    queryKey: ["schedule", from, to],
    queryFn: () => backend.schedule.list({ from, to }),
    enabled: !!from && !!to,
    refetchInterval: 5 * 60_000,
  });
  const canteenQ = useQuery({
    queryKey: ["canteen", watch, shift?.date ?? "", shift?.label ?? ""],
    queryFn: () => backend.crewing.listCanteen({ watch, shift_date: shift!.date, shift_type: shift!.label as crewing.ShiftType }),
    enabled: !!watch && !!shift,
  });

  if (!watch) return null;

  const heading = !shift
    ? "This shift"
    : shift.on_duty
    ? "This shift"
    : `Next shift · ${new Date(shift.start).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`;

  const items = shift
    ? shiftToday({
        shift,
        tasks: boardQ.data?.tasks ?? [],
        templates: templatesQ.data ?? [],
        events: eventsQ.data?.events ?? [],
        canteen: (canteenQ.data?.duties ?? []).map((d) => d.user_name ?? "").filter(Boolean),
      })
    : [];
  const left = todayLeft(items);
  const shown = items.length > MAX_ROWS ? items.slice(0, MAX_ROWS - 1) : items;
  const more = items.length - shown.length;

  return (
    <div className="mt-5 overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-white/10">
      <div className="flex items-baseline justify-between gap-3 px-3.5 pb-1.5 pt-3">
        <h3 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-white/50">{heading}</h3>
        {shift && (
          <span className="text-xs text-white/60">
            {left > 0 ? <><span className="font-mono font-semibold text-white">{left}</span> to do</> : items.length > 1 ? "All done" : null}
          </span>
        )}
      </div>
      {boardQ.isLoading ? (
        <div className="space-y-1.5 px-3.5 pb-3.5 pt-1" aria-hidden>
          {[0, 1, 2].map((i) => <div key={i} className="h-8 animate-pulse rounded-md bg-white/[0.06]" />)}
        </div>
      ) : !shift ? (
        <p className="px-3.5 pb-3.5 pt-1 text-sm text-white/60">No shift coming up for {watch} Watch.</p>
      ) : (
        <ul className="divide-y divide-white/[0.06] pb-1">
          {shown.map((item) => <Row key={item.key} item={item} accent={accent} canOpen={canOpen} />)}
          {more > 0 && (
            <li>
              <Link
                to="/tasks"
                className="flex min-h-11 items-center gap-2.5 px-3.5 py-2 text-sm text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white sm:min-h-10"
              >
                <span className="w-11 shrink-0" aria-hidden />
                <span className="flex-1">+{more} more on the shift board</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/25" aria-hidden />
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
