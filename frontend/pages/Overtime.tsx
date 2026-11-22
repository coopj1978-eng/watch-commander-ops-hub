import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Download, Timer } from "lucide-react";
import backend from "@/lib/backend";
import { useAuth } from "@/App";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { hoursText, monthName, monthRange, monthShift, thisMonth, watchOvertime, watchOvertimeCsv } from "@/lib/overtime";

// ──────────────────────────────────────────────────────────────────────────────
// Overtime — the whole watch, one month at a time (John, 22 Nov 2026).
//
// A profile's Hours tab already adds one person's overtime up by month; this
// is the same sum for everyone on the watch, so a WC or CC can see the month
// on one screen and take it away as a spreadsheet. Hours only — pay stays in
// iTrent. Nothing is entered here: overtime goes on from the calendar
// (New → Log shift → Overtime).
//
// WC/CC and the admin only (the route in App.tsx turns anyone else away).
// ──────────────────────────────────────────────────────────────────────────────

const WATCHES = ["Red", "White", "Green", "Blue", "Amber"];
const dayText = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

export default function Overtime() {
  const { user } = useAuth();
  const own = user?.watch_unit ?? "";
  // Someone not on a watch (the admin account) picks whose month to look at.
  const [picked, setPicked] = useState("");
  const watch = own || picked;

  const [month, setMonth] = useState(thisMonth());
  const [open, setOpen] = useState<string | null>(null);
  const isNow = month >= thisMonth();
  const { from, to } = monthRange(month);

  const roster = useQuery({
    queryKey: ["crewing-roster", watch],
    queryFn: () => backend.crewing.roster({ watch }),
    enabled: !!watch,
  });
  const bookings = useQuery({
    queryKey: ["shift-adjustments", "overtime-month", month],
    queryFn: () => backend.shift_adjustments.list({ start_date: from, end_date: to }),
    enabled: !!watch,
  });

  const loading = roster.isLoading || bookings.isLoading;
  const failed = roster.isError || bookings.isError;
  const data = watchOvertime(roster.data?.members ?? [], bookings.data?.adjustments ?? [], month);

  const download = () => {
    const url = URL.createObjectURL(new Blob([watchOvertimeCsv(data)], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `Overtime ${watch} Watch ${monthName(month)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-3 text-3xl font-bold text-foreground">
            <Timer className="h-7 w-7 shrink-0 text-brand" aria-hidden="true" />
            Overtime
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {watch ? `${watch} Watch, month by month.` : "A watch's overtime, month by month."} Hours only — pay stays in iTrent.
          </p>
        </div>
        {watch && (
          <Button variant="outline" disabled={loading || data.entries === 0} onClick={download}>
            <Download className="mr-2 h-4 w-4" />Download
          </Button>
        )}
      </div>

      {!own && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Watch">
          {WATCHES.map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={picked === w}
              onClick={() => { setPicked(w); setOpen(null); }}
              className={cn(
                "tap-chip rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                picked === w ? "border-foreground bg-foreground text-background" : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {w} Watch
            </button>
          ))}
        </div>
      )}

      {!watch ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">Pick a watch to see its overtime.</p>
      ) : (
        <>
          {/* ── Month ─────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-border/70 bg-card p-2">
            <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => { setMonth(monthShift(month, -1)); setOpen(null); }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 text-center">
              <p className="truncate text-base font-semibold">{monthName(month)}</p>
              {!isNow && (
                <button type="button" className="tap text-xs text-brand hover:underline" onClick={() => { setMonth(thisMonth()); setOpen(null); }}>
                  Back to this month
                </button>
              )}
            </div>
            <Button variant="ghost" size="icon" aria-label="Next month" disabled={isNow} onClick={() => { setMonth(monthShift(month, 1)); setOpen(null); }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* ── The month in three numbers ────────────────────────────────── */}
          <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 text-center">
            {[
              { k: "Hours", v: loading ? "–" : hoursText(data.hours) },
              { k: data.entries === 1 ? "Entry" : "Entries", v: loading ? "–" : String(data.entries) },
              { k: "People", v: loading ? "–" : `${data.withSome} of ${data.people.length}` },
            ].map((s) => (
              <div key={s.k} className="bg-card px-2 py-3">
                <dd className="text-2xl font-semibold tabular-nums">{s.v}</dd>
                <dt className="text-xs text-muted-foreground">{s.k}</dt>
              </div>
            ))}
          </dl>

          {/* ── Everyone on the watch ─────────────────────────────────────── */}
          {failed ? (
            <p role="alert" className="rounded-xl border border-red-300/70 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
              Couldn't load the overtime. Check your signal and try again.
            </p>
          ) : loading ? (
            <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
          ) : data.people.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">Nobody is on {watch} Watch yet.</p>
          ) : (
            <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 bg-card">
              {data.people.map((p) => {
                const has = p.entries.length > 0;
                const isOpen = open === p.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={!has}
                      aria-expanded={has ? isOpen : undefined}
                      onClick={() => setOpen(isOpen ? null : p.id)}
                      className={cn("flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left", has && "transition-colors hover:bg-muted/50 active:bg-muted/60")}
                    >
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm font-semibold", !has && "font-medium text-muted-foreground")}>
                          {p.name} {p.role && <span className="font-normal text-muted-foreground">{p.role}</span>}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {has ? `${p.entries.length} ${p.entries.length === 1 ? "entry" : "entries"}` : "None this month"}
                        </span>
                      </span>
                      <span className={cn("shrink-0 text-right tabular-nums", has ? "text-lg font-semibold" : "text-sm text-muted-foreground")}>
                        {has ? <>{hoursText(p.hours)}<span className="ml-0.5 text-xs font-normal text-muted-foreground">hrs</span></> : "—"}
                      </span>
                      {has && <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} aria-hidden="true" />}
                    </button>
                    {has && isOpen && (
                      <div className="border-t border-border/50 bg-muted/30 px-4 py-2">
                        <ul className="divide-y divide-border/40">
                          {p.entries.map((e) => (
                            <li key={e.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                              <span className="min-w-0">
                                <span className="font-medium">{dayText(e.date)}</span>
                                <span className="text-muted-foreground">
                                  {e.dayNight ? ` · ${e.dayNight}` : ""}{e.withWatch ? ` · with ${e.withWatch} Watch` : ""}
                                </span>
                                {e.notes && <span className="block break-words text-xs text-muted-foreground">{e.notes}</span>}
                              </span>
                              <span className="shrink-0 tabular-nums">{hoursText(e.hours)} hrs</span>
                            </li>
                          ))}
                        </ul>
                        <Link to={`/people/${p.id}?tab=hours`} className="tap mt-1 inline-block text-xs text-brand hover:underline">
                          {p.name.split(" ")[0]}'s hours →
                        </Link>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-xs text-muted-foreground">
            Overtime goes on from the <Link to="/calendar" className="text-brand hover:underline">calendar</Link>: New, Log shift, Overtime. It counts in the month it was worked.
          </p>
        </>
      )}
    </div>
  );
}
