import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import backend from "@/lib/backend";
import type { shift_adjustments } from "@/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { refreshCalendar } from "@/lib/calendarQueries";
import { KIND_LABEL, parseScheduleCsv, type RosterKind, type ScheduleRow } from "@/lib/rosterDays";
import { ROSTER_DAYS_KEY } from "./RosterDayDialog";

// Admin: load a year's schedule (John, 25 Nov 2026). The file is one line per
// person per day — payroll number, date, code — holding only the days that
// differ from the watch's rota: orange days, purple shifts, courses, moved
// leave. It's checked first and nothing is saved until you say so. Sickness
// codes are never kept (the server drops them too).

type Result = shift_adjustments.ImportRosterDaysResponse;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Summary({ r }: { r: Result }) {
  const kinds = Object.entries(r.by_kind).sort((a, b) => b[1] - a[1]);
  const skipped = Object.entries(r.skipped).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
      <p className="font-medium text-foreground">
        {plural(r.days, "day")} for {plural(r.people, "person", "people")}
        {!r.dry_run && <> — {r.added} added{r.kept > 0 ? `, ${r.kept} left as they were (already confirmed or changed by hand)` : ""}</>}
      </p>
      {kinds.length > 0 && (
        <p className="text-muted-foreground">
          {kinds.map(([k, n]) => `${n} ${(KIND_LABEL[k as RosterKind] ?? k).toLowerCase()}`).join(" · ")}
        </p>
      )}
      {r.unmatched.length > 0 && (
        <p className="text-amber-700 dark:text-amber-400">
          Nobody in the hub has {r.unmatched.length === 1 ? "this payroll number" : "these payroll numbers"}, so their days are left out:{" "}
          <span className="font-mono">{r.unmatched.join(", ")}</span>. Add the person (or their payroll number) and load the file again.
        </p>
      )}
      {skipped.length > 0 && (
        <p className="text-muted-foreground">Codes not kept: {skipped.map(([c, n]) => `${c} (${n})`).join(", ")}.</p>
      )}
      {r.bad > 0 && <p className="text-muted-foreground">{plural(r.bad, "line")} couldn't be read.</p>}
    </div>
  );
}

export function ScheduleImport() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [unreadable, setUnreadable] = useState(0);
  const [checked, setChecked] = useState<Result | null>(null);
  const [loaded, setLoaded] = useState<Result | null>(null);

  const failed = (e: unknown) =>
    toast({ title: "That didn't work", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
  const check = useMutation({
    mutationFn: (r: ScheduleRow[]) => backend.shift_adjustments.importRosterDays({ rows: r, dry_run: true }),
    onSuccess: setChecked,
    onError: failed,
  });
  const load = useMutation({
    mutationFn: () => backend.shift_adjustments.importRosterDays({ rows }),
    onSuccess: (r) => {
      setLoaded(r);
      setChecked(null);
      qc.invalidateQueries({ queryKey: [ROSTER_DAYS_KEY] });
      refreshCalendar(qc);
      toast({ title: "Schedule loaded", description: `${plural(r.added, "day")} added to ${plural(r.people, "calendar")}.` });
    },
    onError: failed,
  });

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setLoaded(null); setChecked(null);
    const parsed = parseScheduleCsv(await file.text());
    setFileName(file.name); setRows(parsed.rows); setUnreadable(parsed.bad);
    if (parsed.rows.length === 0) {
      toast({ title: "No days found in that file", description: "Each line needs a payroll number, a date and a code.", variant: "destructive" });
      return;
    }
    check.mutate(parsed.rows);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Yearly schedule</CardTitle>
        <CardDescription>
          Puts each person's orange days and purple shifts for the year on their own calendar. Orange days show faint
          until the person or their WC/CC confirms them. Loading a year again replaces what was loaded before, but never
          a day someone has already confirmed or changed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={input}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="hidden"
            onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }}
          />
          <Button variant="outline" onClick={() => input.current?.click()} disabled={check.isPending || load.isPending}>
            Choose schedule file
          </Button>
          <span className="text-sm text-muted-foreground">
            {fileName ? `${fileName} · ${plural(rows.length, "line")}${unreadable ? ` (${unreadable} unreadable)` : ""}` : "One line per day: payroll number, date, code"}
          </span>
        </div>
        {check.isPending && <p className="text-sm text-muted-foreground">Checking the file…</p>}
        {checked && (
          <>
            <Summary r={checked} />
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => load.mutate()} disabled={load.isPending || checked.days === 0}>
                {load.isPending ? "Loading…" : `Put ${plural(checked.days, "day")} on ${plural(checked.people, "calendar")}`}
              </Button>
              <span className="text-xs text-muted-foreground">Nothing has been saved yet.</span>
            </div>
          </>
        )}
        {loaded && <Summary r={loaded} />}
      </CardContent>
    </Card>
  );
}
