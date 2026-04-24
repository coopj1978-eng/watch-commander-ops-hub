import { useState, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Stethoscope } from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────────
// LogSickDialog
//
// Shared WC/CC "log this firefighter as sick today" dialog. Previously lived
// inline in both People.tsx and CrewOnWatchTable.tsx as near-identical copies
// (same fields, same backend call, same eForm gate). Now a single component
// so a change to the form or the endpoint shape only has to land in one place.
//
// Defaults:
//   • Date is always today. If you need to log a retrospective sick day you
//     still use the full Absence Create flow — this is the fast-path for "FF
//     has just called in sick, log it now".
//   • eForm confirmation checkbox is mandatory. Matches Service policy that
//     the central staffing eForm has to be submitted first; this is a
//     promise, not a file upload.
//   • Notes textarea is optional.
//
// Cache invalidations are the UNION of what the two previous implementations
// invalidated, so neither caller loses any stale-data defence.
// ──────────────────────────────────────────────────────────────────────────────

export interface LogSickDialogProps {
  open: boolean;
  /** Controlled: invoked with `false` to request close from within. */
  onOpenChange: (open: boolean) => void;
  /** The person being booked off sick. `null` disables the submit button. */
  person: { id: string; name: string } | null;
}

export function LogSickDialog({ open, onOpenChange, person }: LogSickDialogProps) {
  const queryClient = useQueryClient();

  // Local form state — reset whenever the dialog closes so the next open
  // starts clean without the caller having to wire that up.
  const [reason, setReason] = useState("");
  const [eformConfirmed, setEformConfirmed] = useState(false);

  const mutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      // Encore's body parser decodes the backend's `Date` field as a full
      // ISO datetime — passing a date-only string ("2026-04-24") fails
      // with "invalid datetime: premature end of input." Anchor to
      // midnight UTC so the date portion survives Postgres' DATE-column
      // truncation regardless of the user's timezone.
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const todayIso = today.toISOString();
      return await backend.absence.create({
        user_id: userId,
        type: "sickness",
        start_date: todayIso,
        end_date: todayIso,
        reason: reason || "Sick booking logged via Watch Commander Ops Hub",
        evidence_urls: [],
      });
    },
    onSuccess: () => {
      // Union of keys that the two inline implementations used to invalidate.
      // Keeping them all so neither the People page nor the Crew-on-Watch
      // table can miss a refresh.
      queryClient.invalidateQueries({ queryKey: ["absences", "sick-today"] });
      queryClient.invalidateQueries({ queryKey: ["wc-absences-today"] });
      queryClient.invalidateQueries({ queryKey: ["absences-today-sick"] });
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      onOpenChange(false);
    },
    onError: (err) => {
      // Log the underlying error to the console so debugging is possible
      // when a WC reports a failure — the visible UI surfaces the message
      // below, but the structured payload is more useful in DevTools.
      // eslint-disable-next-line no-console
      console.error("LogSickDialog: backend.absence.create failed", err);
    },
  });

  // Try to extract a human-readable reason from whatever shape the Encore
  // client gave us. Encore errors usually have a `.message` and sometimes a
  // `.code`; fall back to JSON if it's something more exotic.
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

  // Reset form state + mutation status whenever we close. Also called when
  // the parent flips `open` back to false (controlled).
  useEffect(() => {
    if (!open) {
      setReason("");
      setEformConfirmed(false);
      mutation.reset();
    }
    // mutation.reset is stable — disabling the lint warning isn't worth it
    // since a spurious reset on open→true is also fine (no in-flight state
    // to clobber the first time through).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
              Date
            </p>
            <p className="font-semibold">
              {new Date().toLocaleDateString("en-GB", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
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
            disabled={!eformConfirmed || mutation.isPending || !person}
            onClick={() => {
              if (person) mutation.mutate({ userId: person.id });
            }}
          >
            {mutation.isPending ? "Logging..." : "Confirm Sick Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
