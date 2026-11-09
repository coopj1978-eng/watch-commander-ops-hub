import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeftRight, MapPin, Moon, Palmtree, Sun } from "lucide-react";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { cn } from "@/lib/utils";
import { useCanOpen } from "@/lib/navigation";
import { CALENDAR_EVENTS_KEY } from "@/lib/calendarQueries";
import { leaveLine, localDay, shiftLine, type ShiftLine } from "@/lib/myNextShifts";

// "My next shifts" (Nov 2026) — the top of a firefighter's Home, from the
// council's FF-first review: each of your coming shifts with whether you're
// on and where you ride, off (and why), detached, or in for an extra. Under
// the calendar's key, so booking changes refresh it with the calendar.

/** Your own shifts — shared by this card and the shift panel's "You: …". */
export function useMyShifts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [CALENDAR_EVENTS_KEY, "my-shifts", user?.id],
    queryFn: () => backend.crewing.myShiftsApi({ days: 21 }),
    enabled: !!user?.id,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

function useMinute() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const FIRST = 5;

const PILL: Record<ShiftLine["tone"], string> = {
  on: "bg-muted text-foreground",
  off: "bg-transparent text-muted-foreground ring-1 ring-inset ring-border",
  detached: "bg-sky-500/10 text-sky-800 dark:text-sky-300",
  extra: "bg-brand/10 text-brand dark:text-brand-bright ring-1 ring-inset ring-brand/25",
};

function ShiftIcon({ line }: { line: ShiftLine }) {
  const Icon = line.tone === "extra" ? ArrowLeftRight : line.tone === "detached" ? MapPin : line.night ? Moon : Sun;
  return (
    <Icon
      aria-hidden
      className={cn(
        "h-3.5 w-3.5 shrink-0",
        line.tone === "off" ? "text-muted-foreground/60"
          : line.tone === "extra" ? "text-brand dark:text-brand-bright"
          : line.tone === "detached" ? "text-sky-600 dark:text-sky-400"
          : line.night ? "text-indigo-500" : "text-amber-500",
      )}
    />
  );
}

export function MyNextShifts() {
  const now = useMinute();
  const canOpen = useCanOpen();
  const q = useMyShifts();
  const [all, setAll] = useState(false);

  const shifts = (q.data?.shifts ?? []).filter((s) => new Date(s.end) > now);
  const leave = q.data?.leave ?? null;
  const today = localDay(now);
  const shown = all ? shifts : shifts.slice(0, FIRST);
  const calendar = canOpen("/calendar");
  // The leave block sits in date order among the shifts (first, if it's on
  // now) — at the end only when no hidden shift comes before it.
  let leaveAt = -1;
  if (leave) {
    const i = shown.findIndex((s) => s.date > leave.start);
    if (i >= 0) leaveAt = i;
    else if (shown.length === shifts.length || shifts[shown.length].date > leave.start) leaveAt = shown.length;
  }
  const leaveRow = leave && leaveAt >= 0 ? leaveLine(leave, today) : null;

  const rows: ({ kind: "shift"; key: string; line: ShiftLine; date: string } | { kind: "leave" })[] = shown.map((s) => ({
    kind: "shift" as const,
    key: `${s.date}-${s.shift_type}-${s.watch}`,
    line: shiftLine(s, now),
    date: s.date,
  }));
  if (leaveRow) rows.splice(leaveAt, 0, { kind: "leave" });

  return (
    <section aria-label="My next shifts" className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">My next shifts</h2>
        {calendar && (
          <Link to="/calendar" className="text-xs text-muted-foreground hover:text-foreground">
            Calendar →
          </Link>
        )}
      </div>

      {q.isLoading ? (
        <div className="mt-3 space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-11 animate-pulse rounded-lg bg-muted/60" />)}
        </div>
      ) : q.isError ? (
        <p className="mt-3 text-sm text-muted-foreground">Couldn't load your shifts. Pull down to try again.</p>
      ) : !q.data?.watch && shifts.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Your watch isn't set on your profile yet, so there's no rota to show. Ask your Watch Commander to set it.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No shifts in the next three weeks.</p>
      ) : (
        <ol className="mt-1.5 divide-y divide-border/50">
          {rows.map((r) => {
            if (r.kind === "leave") {
              return (
                <li key="leave" className="flex items-center gap-3 py-2.5">
                  <div className="flex w-[4.75rem] shrink-0 items-center">
                    <Palmtree aria-hidden className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{leaveRow!.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{leaveRow!.detail}</div>
                  </div>
                </li>
              );
            }
            const { line } = r;
            const body = (
              <>
                <div className="w-[4.75rem] shrink-0">
                  <div className={cn("text-sm font-semibold leading-tight", line.now && "text-brand dark:text-brand-bright")}>
                    {line.now && <span aria-hidden className="mr-1.5 inline-block h-1.5 w-1.5 -translate-y-0.5 rounded-full bg-current" />}
                    {line.when}
                  </div>
                  {line.date && <div className="text-[11px] leading-tight text-muted-foreground">{line.date}</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <ShiftIcon line={line} />
                    <span
                      className={cn(
                        "truncate text-sm",
                        line.tone === "off" ? "text-muted-foreground line-through decoration-muted-foreground/50" : "font-medium",
                      )}
                    >
                      {line.shift}
                    </span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    <span className={cn("font-mono tabular-nums", line.tone === "off" && "line-through decoration-muted-foreground/50")}>{line.times}</span>
                    {line.detail && (
                      <span className={cn(line.waiting && "font-medium text-amber-700 dark:text-amber-400")}> · {line.detail}</span>
                    )}
                  </div>
                </div>
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", PILL[line.tone])}>{line.tag}</span>
              </>
            );
            return (
              <li key={r.key}>
                {calendar ? (
                  <Link
                    to={`/calendar?date=${r.date}`}
                    className="-mx-2 flex min-h-[3.25rem] items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex min-h-[3.25rem] items-center gap-3 py-2">{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {shifts.length > FIRST && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-1 w-full rounded-lg py-2 text-center text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        >
          {all ? "Show fewer" : `Show all ${shifts.length} (next 3 weeks)`}
        </button>
      )}
    </section>
  );
}
