import type { CrewPlan } from "@/lib/autoCrew";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, Truck } from "lucide-react";

// Review the auto-crew proposal before anything is saved: who goes where on
// each pump, and any seat nobody qualified is free for.

const APPLIANCES = [
  { key: "b10p1", label: "B10P1 — 1st Pump" },
  { key: "b10p2", label: "B10P2 — 2nd Pump" },
] as const;

export function AutoCrewDialog({
  open, plan, busy, onApply, onClose,
}: { open: boolean; plan: CrewPlan; busy: boolean; onApply: () => void; onClose: () => void }) {
  const required = plan.unfilled.filter((s) => s.required);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Auto-crew</DialogTitle>
          <DialogDescription>
            Qualified people who are free this shift, officers in charge, drivers with LGV, BA wearers in BA seats.
            Nothing is saved until you apply — you can still swap anyone afterwards.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {APPLIANCES.map((a) => {
            const picks = plan.picks.filter((p) => p.seat.appliance === a.key);
            const gaps = plan.unfilled.filter((s) => s.appliance === a.key);
            if (!picks.length && !gaps.length) return null;
            return (
              <section key={a.key}>
                <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
                  <Truck className="h-4 w-4 text-muted-foreground" /> {a.label}
                </div>
                <ul className="divide-y divide-border/60 rounded-xl border border-border/70">
                  {picks.map(({ seat, member }) => (
                    <li key={seat.key} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="w-28 shrink-0 text-muted-foreground">{seat.label}</span>
                      <span className="min-w-0 flex-1 truncate text-right font-medium">{member.name}</span>
                    </li>
                  ))}
                  {gaps.map((seat) => (
                    <li key={seat.key} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="w-28 shrink-0 text-muted-foreground">{seat.label}</span>
                      <span className="flex items-center gap-1.5 text-right text-xs font-medium text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5" /> Nobody qualified free
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {required.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Seats left empty need cover — an external or change of shift from the seat's picker, or a Head for Head.
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={onApply} disabled={busy || plan.picks.length === 0} className="bg-brand text-brand-foreground hover:bg-brand/90">
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Crew {plan.picks.length} seat{plan.picks.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
