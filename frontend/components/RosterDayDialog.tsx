import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import backend from "@/lib/backend";
import type { shift_adjustments } from "@/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { refreshCalendar } from "@/lib/calendarQueries";
import { KIND_LABEL, kindMeaning, shiftHours, type RosterKind } from "@/lib/rosterDays";
import { cn } from "@/lib/utils";

// One of your own days on top of the watch rota (John, 25 Nov 2026): open an
// orange day to say you're in (it goes from faint to dark orange), or take a
// day off your calendar; or add one. Either you or your WC/CC can do it —
// whoever didn't is told.

/** Every list that shows roster days. */
export const ROSTER_DAYS_KEY = "roster-days";

type RosterDay = shift_adjustments.RosterDay;
type DayNight = "Day" | "Night";
const ADDABLE: RosterKind[] = ["orange", "purple", "training"];
const niceDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export interface RosterDayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The day being looked at; leave out to add one. */
  day?: RosterDay | null;
  /** Adding: the date to start on (YYYY-MM-DD). */
  defaultDate?: string;
  /** Adding for someone else (WC/CC); leave out for yourself. */
  forUser?: { id: string; name: string } | null;
  /** The signed-in person — decides the wording ("you" or their name). */
  meId: string;
}

export default function RosterDayDialog({ open, onOpenChange, day, defaultDate, forUser, meId }: RosterDayDialogProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [date, setDate] = useState(defaultDate ?? "");
  const [kind, setKind] = useState<RosterKind>("orange");
  const [dn, setDn] = useState<DayNight>("Day");
  useEffect(() => {
    if (open && !day) { setDate(defaultDate ?? ""); setKind("orange"); setDn("Day"); }
  }, [open, day, defaultDate]);

  const done = (title: string, description?: string) => {
    qc.invalidateQueries({ queryKey: [ROSTER_DAYS_KEY] });
    refreshCalendar(qc);
    toast({ title, description });
    onOpenChange(false);
  };
  const failed = (e: unknown) =>
    toast({ title: "That didn't save", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });

  const own = day ? day.user_id === meId : !forUser || forUser.id === meId;
  const told = own ? "Your WC and CC are told." : `${day?.user_name ?? forUser?.name ?? "They"} will be told.`;

  const confirm = useMutation({
    mutationFn: (confirmed: boolean) => backend.shift_adjustments.confirmRosterDay(day!.id, { confirmed }),
    onSuccess: (_r, confirmed) =>
      done(confirmed ? "Orange day confirmed" : "Back to “might be called in”", told),
    onError: failed,
  });
  const remove = useMutation({
    mutationFn: () => backend.shift_adjustments.deleteRosterDay(day!.id),
    onSuccess: () => done("Taken off the calendar", told),
    onError: failed,
  });
  const add = useMutation({
    mutationFn: () =>
      backend.shift_adjustments.saveRosterDay({
        ...(forUser && forUser.id !== meId ? { user_id: forUser.id } : {}),
        day: date, kind, ...(kind === "training" ? {} : { day_night: dn }),
      }),
    onSuccess: () => done(`${KIND_LABEL[kind]} added`, told),
    onError: failed,
  });
  const busy = confirm.isPending || remove.isPending || add.isPending;

  const seg = (on: boolean) =>
    cn(
      "tap flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
      on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted",
    );

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        {day ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {KIND_LABEL[day.kind]}
                {day.kind === "orange" && (
                  <span
                    className="ml-2 inline-block rounded-full px-2 py-0.5 align-middle text-xs font-semibold"
                    style={day.confirmed
                      ? { background: "var(--cal-orange-bg)", color: "var(--cal-orange-fg)" }
                      : { background: "var(--cal-maybe-bg)", color: "var(--cal-maybe-fg)", border: "1px dashed var(--cal-orange-dot)" }}
                  >
                    {day.confirmed ? "Confirmed" : "Might be called in"}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription>
                {!own && <>{day.user_name} · </>}
                {niceDay(day.day)}
                {day.day_night ? ` · ${shiftHours(day.day_night)}` : ""}
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {own ? kindMeaning(day.kind, day.confirmed) : kindMeaning(day.kind, day.confirmed).replace(/^You're/, "They're").replace(/\byou\b/g, "they")}
            </p>
            <p className="text-xs text-muted-foreground">{told}</p>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="ghost" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => remove.mutate()}>
                Take off the calendar
              </Button>
              {day.kind === "orange" && (
                day.confirmed
                  ? <Button variant="outline" disabled={busy} onClick={() => confirm.mutate(false)}>Not confirmed after all</Button>
                  : <Button disabled={busy} onClick={() => confirm.mutate(true)}>{own ? "I'm in — confirm" : "Confirm they're in"}</Button>
              )}
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Orange or purple day</DialogTitle>
              <DialogDescription>
                {forUser && forUser.id !== meId ? `On ${forUser.name}'s calendar.` : "On your own calendar."} {told}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="roster-day-date">Date</Label>
                <Input id="roster-day-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>What is it?</Label>
                <div className="flex gap-2" role="group" aria-label="What is it?">
                  {ADDABLE.map((k) => (
                    <button key={k} type="button" aria-pressed={kind === k} className={seg(kind === k)} onClick={() => setKind(k)}>
                      {KIND_LABEL[k]}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{kindMeaning(kind, false)}</p>
              </div>
              {kind !== "training" && (
                <div className="space-y-1.5">
                  <Label>Shift</Label>
                  <div className="flex gap-2" role="group" aria-label="Shift">
                    {(["Day", "Night"] as const).map((v) => (
                      <button key={v} type="button" aria-pressed={dn === v} className={seg(dn === v)} onClick={() => setDn(v)}>
                        {shiftHours(v)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button disabled={busy || !date} onClick={() => add.mutate()}>Add to calendar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
