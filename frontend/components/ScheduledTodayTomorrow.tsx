import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, isToday, isTomorrow, parseISO, startOfDay } from "date-fns";
import backend from "@/lib/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, CalendarDays } from "lucide-react";
import type { schedule } from "@/client";

// ──────────────────────────────────────────────────────────────────────────────
// ScheduledTodayTomorrow
//
// Unified "what's on" table for today + tomorrow. Aggregates inspections,
// drills, one-to-ones, meetings, maintenance, and reminders via the single
// /schedule endpoint so the dashboard only makes one request to populate it.
//
// Based on the original design refresh mockup — pill-coloured type badges,
// right-aligned crew initials with · separators, muted "Open ›" action.
// Day label (Today / Tue / Wed) prefixes the time in the WHEN column.
// ──────────────────────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<
  schedule.ScheduleEventType,
  { label: string; pill: string; neutralPill: string }
> = {
  hfsv: {
    label: "HFSV",
    // Critical variant (is_critical=true) — red. Default — neutral grey.
    pill: "bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
    neutralPill:
      "bg-muted text-muted-foreground border border-border",
  },
  high_rise: {
    label: "HIGH-RISE",
    pill: "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
    neutralPill:
      "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  },
  hydrant: {
    label: "HYDRANT",
    pill: "bg-green-100 text-green-700 border border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900",
    neutralPill:
      "bg-green-100 text-green-700 border border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900",
  },
  drill: {
    label: "DRILL",
    pill: "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    neutralPill:
      "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  },
  one_to_one: {
    label: "ONE-TO-ONE",
    // Critical → red (Stage 3 review). Non-critical → rose.
    pill: "bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
    neutralPill:
      "bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
  },
  meeting: {
    label: "MEETING",
    pill: "bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900",
    neutralPill:
      "bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900",
  },
  maintenance: {
    label: "MAINT.",
    pill: "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    neutralPill:
      "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  },
  reminder: {
    label: "REMINDER",
    pill: "bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900",
    neutralPill:
      "bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900",
  },
  other: {
    label: "OTHER",
    pill: "bg-muted text-muted-foreground border border-border",
    neutralPill: "bg-muted text-muted-foreground border border-border",
  },
};

function dayLabel(iso: string): string {
  const d = parseISO(iso);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tue"; // generic "next day" if tomorrow is e.g. Tue
  return format(d, "EEE");
}

function timeLabel(iso: string): string {
  return format(parseISO(iso), "HH:mm");
}

export function ScheduledTodayTomorrow() {
  // Default range — today + tomorrow. Start of today → end of tomorrow.
  const { from, to } = useMemo(() => {
    const now = startOfDay(new Date());
    const fromStr = format(now, "yyyy-MM-dd");
    const toDate = new Date(now);
    toDate.setDate(toDate.getDate() + 1);
    const toStr = format(toDate, "yyyy-MM-dd");
    return { from: fromStr, to: toStr };
  }, []);

  const q = useQuery({
    queryKey: ["schedule", from, to],
    queryFn: () => backend.schedule.list({ from, to }),
    refetchInterval: 5 * 60_000,
  });

  const events = q.data?.events ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-brand" />
          <CardTitle className="text-sm font-medium">
            Scheduled today &amp; tomorrow
          </CardTitle>
        </div>
        <Link
          to="/calendar"
          className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View calendar
          <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>

      <CardContent className="p-0">
        {q.isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing scheduled in the next 48 hours.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y bg-muted/40 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="text-left font-semibold px-4 py-2 w-[130px]">
                    When
                  </th>
                  <th className="text-left font-semibold px-2 py-2 w-[120px]">
                    Type
                  </th>
                  <th className="text-left font-semibold px-2 py-2">What</th>
                  <th className="text-left font-semibold px-2 py-2 w-[160px]">
                    Crew
                  </th>
                  <th className="w-[60px]"></th>
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <ScheduleRow
                    key={e.id}
                    event={e}
                    even={i % 2 === 0}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScheduleRow({
  event,
  even,
}: {
  event: schedule.ScheduleEvent;
  even: boolean;
}) {
  const style = TYPE_STYLES[event.type];
  const pillClass = event.is_critical ? style.pill : style.neutralPill;

  // Crew initials — cap at 3 visible, "+N" for the rest.
  const maxInline = 3;
  const visibleCrew = event.crew.slice(0, maxInline);
  const overflow = Math.max(0, event.crew.length - maxInline);

  return (
    <tr
      className={`border-b border-border/40 last:border-0 ${
        even ? "" : "bg-muted/20"
      }`}
    >
      <td className="px-4 py-3 align-top whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
        <span className="font-semibold text-foreground mr-2">
          {dayLabel(event.when)}
        </span>
        {timeLabel(event.when)}
      </td>
      <td className="px-2 py-3 align-top">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-widest ${pillClass}`}
        >
          {style.label}
        </span>
      </td>
      <td className="px-2 py-3 align-top">
        <p className="text-sm leading-tight">
          {event.what}
          {event.is_critical && (
            <span className="text-muted-foreground"> (critical)</span>
          )}
        </p>
      </td>
      <td className="px-2 py-3 align-top font-mono text-xs tabular-nums text-muted-foreground">
        {event.crew.length === 0 ? (
          <span className="text-muted-foreground/40">—</span>
        ) : (
          <span className="inline-flex items-center gap-1 flex-wrap">
            {visibleCrew.map((c, i) => (
              <span key={c.id} className="inline-flex items-center gap-1">
                <span title={c.name}>{c.initials}</span>
                {i < visibleCrew.length - 1 && (
                  <span className="text-muted-foreground/40">·</span>
                )}
              </span>
            ))}
            {overflow > 0 && (
              <span className="text-muted-foreground/60 ml-1">
                +{overflow}
              </span>
            )}
          </span>
        )}
      </td>
      <td className="px-4 py-3 align-top text-right">
        <Link
          to={event.link}
          className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
        >
          Open
          <ChevronRight className="h-3 w-3" />
        </Link>
      </td>
    </tr>
  );
}
