import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import backend from "@/lib/backend";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Stethoscope, CalendarDays } from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────────
// LogSickDialog
//
// Shared WC/CC "log this firefighter as sick" dialog. Used from People.tsx
// and CrewOnWatchTable.tsx.
//
// Supports retrospective entries (backdating): WCs frequently learn about
// a sickness after the fact — a FF didn't turn up to a 6am parade and
// the WC only logs it after first sit-down at 9. Both start and end
// dates default to today but can be moved earlier; future dates are
// disallowed because sickness is reactive, not predictive.
//
// eForm confirmation checkbox is mandatory regardless of when the
// sickness happened — the central-staffing form has to be submitted
// before any digital record goes in.
// ──────────────────────────────────────────────────────────────────────────────

export interface LogSickDialogProps {
  open: boolean;
  /** Controlled: invoked with `false` to request close from within. */
  onOpenChange: (open: boolean) => void;
  /** The person being booked off sick. `null` disables the submit button. */
  person: { id: string; name: string } | null;
}

/** Today as YYYY-MM-DD in the user's local timezone (the format `<input
 *  type="date">` expects). Used for both initial-state defaults and the
 *  `max` attribute on the pickers (no future-dating). */
function todayLocalIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Convert a YYYY-MM-DD picker value to the full ISO datetime that
 *  Encore's body parser requires for `Date` fields. Anchor to midnight
 *  UTC so the date portion survives the DATE-column truncation
 *  regardless of the WC's local timezone. */
function dateToIso(yyyy_mm_dd: string): string {
  const d = new Date(yyyy_mm_dd + "T00:00:00.000Z");
  return d.toISOString();
}

export function LogSickDialog({ open, onOpenChange, person }: LogSickDialogProps) {
  const queryClient = useQueryClient();

  const today = useMemo(() => todayLocalIso(), []);

  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(today);
  const [reason, setReason] = useState("");
  const [eformConfirmed, setEformConfirmed] = useState(false);

  const mutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      return await backend.absence.create({
        user_id: userId,
        type: "sickness",
        start_date: dateToIso(startDate),
        end_date: dateToIso(endDate),
        reason: reason || "Sick booking logged via Watch Commander Ops Hub",
        evidence_urls: [],
      });
    },
    onSuccess: () => {
      // Union of every cache key any caller depends on.
      queryClient.invalidateQueries({ queryKey: ["absences", "sick-today"] });
      queryClient.invalidateQueries({ queryKey: ["wc-absences-today"] });
      queryClient.invalidateQueries({ queryKey: ["absences-today-sick"] });
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      onOpenChange(false);
    },
    onError: (err) => {
      console.error("LogSickDialog: backend.absence.create failed", err);
    },
  });

  // Pull a useful message out of whatever shape Encore returned so the
  // UI surfaces the actual reason instead of a generic toast.
  const errorDetail = (() => {
    const err = mutation.error as
      | { message?: string; code?: string; details?: unknown }
      | null;
    if (!err) return null;
    if (err.message && typeof err.message === "string") return err.message;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  })();

  // Reset form + mutation when closed.
  useEffect(() => {
    if (!open) {
      setStartDate(today);
      setEndDate(today);
      setReason("");
      setEformConfirmed(false);
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, today]);

  // If the user picks an earlier end date than start, snap end to start
  // so the range is always valid. (No future dates allowed for either —
  // enforced by the `max` attribute on each picker.)
  useEffect(() => {
    if (endDate < startDate) setEndDate(startDate);
  }, [startDate, endDate]);

  // Days-off summary, inclusive of both endpoints. e.g. start=end → 1 day.
  const daysOff = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const a = new Date(startDate + "T00:00:00").getTime();
    const b = new Date(endDate + "T00:00:00").getTime();
    if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
    return Math.round((b - a) / 86_400_000) + 1;
  }, [startDate, endDate]);

  const isBackdated = startDate !== today;
  const formIsValid = !!person && !!startDate && !!endDate && eformConfirmed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-red-500" />
            Log Sick Booking
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
              Firefighter
            </p>
            <p className="font-semibold">{person?.name}</p>
          </div>

          {/* ── Date range — backdate-friendly ────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Sick from / to</Label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label
                  htmlFor="log-sick-start"
                  className="text-[11px] text-muted-foreground mb-1 block"
                >
                  First day off
                </Label>
                <Input
                  id="log-sick-start"
                  type="date"
                  value={startDate}
                  max={today}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <Label
                  htmlFor="log-sick-end"
                  className="text-[11px] text-muted-foreground mb-1 block"
                >
                  Last day off
                </Label>
                <Input
                  id="log-sick-end"
                  type="date"
                  value={endDate}
                  min={startDate}
                  max={today}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {daysOff > 0 ? (
                <>
                  <span className="font-semibold text-foreground">
                    {daysOff} day{daysOff === 1 ? "" : "s"}
                  </span>{" "}
                  off
                  {isBackdated && (
                    <span className="ml-1 text-amber-600 dark:text-amber-400">
                      · backdated
                    </span>
                  )}
                </>
              ) : (
                <span className="text-red-600 dark:text-red-400">
                  Pick a valid date range
                </span>
              )}
            </p>
          </div>

          <div>
            <Label htmlFor="log-sick-reason" className="text-sm font-medium">
              Notes{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="log-sick-reason"
              placeholder="Any additional notes about this sick booking..."
              className="mt-1.5 resize-none"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
            <Checkbox
              id="log-sick-eform-confirmed"
              checked={eformConfirmed}
              onCheckedChange={(checked) => setEformConfirmed(!!checked)}
              className="mt-0.5"
            />
            <label
              htmlFor="log-sick-eform-confirmed"
              className="text-sm cursor-pointer leading-snug"
            >
              <span className="font-medium">eForm submitted to central staffing</span>
              <span className="block text-muted-foreground text-xs mt-0.5">
                Confirm the sickness eForm has been completed and submitted before logging
                {isBackdated &&
                  " — required even when backdating an entry"}
              </span>
            </label>
          </div>

          {mutation.isError && (
            <div className="rounded-lg border border-red-300 bg-red-50/80 p-3 dark:border-red-900 dark:bg-red-950/30">
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                Failed to log sick booking
              </p>
              {errorDetail && (
                <p className="text-xs text-red-700/80 dark:text-red-300/80 mt-1 font-mono break-words">
                  {errorDetail}
                </p>
              )}
              <p className="text-xs text-red-700/70 dark:text-red-300/70 mt-1">
                Please try again, or share the message above with the
                administrator if it keeps happening.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-brand hover:bg-brand/90 text-brand-foreground"
            disabled={!formIsValid || mutation.isPending}
            onClick={() => {
              if (person) mutation.mutate({ userId: person.id });
            }}
          >
            {mutation.isPending
              ? "Logging..."
              : daysOff > 1
              ? `Confirm Sick Booking (${daysOff} days)`
              : "Confirm Sick Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
