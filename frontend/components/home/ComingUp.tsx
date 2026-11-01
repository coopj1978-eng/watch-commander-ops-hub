import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import backend from "@/lib/backend";
import { useAuth } from "@/App";
import { getShiftForDate } from "@/lib/shiftRota";

// The week ahead (Nov 2026): what's on the calendar for the next seven days,
// a line per event under its day, with the watch's own shift for that day —
// so a WC can see which of them land on their watch. Replaces the mini month
// calendar and the "tomorrow" half of Scheduled today & tomorrow.

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function ComingUp() {
  const { user } = useAuth();
  const watch = user?.watch_unit ?? "";
  const { from, to } = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const e = new Date(d);
    e.setDate(e.getDate() + 6);
    return { from: iso(d), to: iso(e) };
  }, []);
  const q = useQuery({
    queryKey: ["schedule", from, to],
    queryFn: () => backend.schedule.list({ from, to }),
    refetchInterval: 10 * 60_000,
  });

  const days = useMemo(() => {
    const byDay = new Map<string, NonNullable<typeof q.data>["events"]>();
    for (const e of q.data?.events ?? []) {
      const k = iso(new Date(e.when));
      if (k < from || k > to) continue;
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k)!.push(e);
    }
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [q.data, from, to]);

  return (
    <section aria-label="Coming up" className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Coming up · next 7 days</h2>
        <Link to="/calendar" className="text-xs text-muted-foreground hover:text-foreground">Calendar →</Link>
      </div>
      {q.isLoading ? (
        <div className="mt-3 space-y-2">{[0, 1].map((i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-muted/60" />)}</div>
      ) : days.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing on the calendar this week.</p>
      ) : (
        <div className="mt-2 divide-y divide-border/50">
          {days.slice(0, 6).map(([day, events]) => {
            const d = new Date(`${day}T12:00:00`);
            const s = watch ? getShiftForDate(watch, d) : null;
            return (
              <div key={day} className="flex gap-4 py-2.5">
                <div className="w-16 shrink-0">
                  <div className="text-sm font-semibold">{d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })}</div>
                  <div className="text-[11px] text-muted-foreground">{s?.isWorking ? s.shiftType : s?.isLeave ? "Leave" : "Off"}</div>
                </div>
                <ul className="min-w-0 flex-1 space-y-1">
                  {events.slice(0, 4).map((e) => (
                    <li key={e.id}>
                      <Link to={e.link || "/calendar"} className="flex items-baseline gap-2 text-sm hover:text-primary">
                        <span className="w-10 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                          {new Date(e.when).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="min-w-0 truncate">{e.what}</span>
                        {e.is_critical && <span className="shrink-0 text-[10px] font-semibold uppercase text-red-600 dark:text-red-400">Critical</span>}
                      </Link>
                    </li>
                  ))}
                  {events.length > 4 && <li className="pl-12 text-xs text-muted-foreground">+{events.length - 4} more</li>}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
