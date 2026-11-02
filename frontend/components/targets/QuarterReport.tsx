import { useQuery } from "@tanstack/react-query";
import { Copy, Mail } from "lucide-react";
import backend from "@/lib/backend";
import { useAuth } from "@/App";
import { COMMUNITY_TAP_MIN, COMMUNITY_TARGET_Q, HFSV_TARGET_Q } from "@/lib/targets";
import { quarterTime, type FyQuarter } from "@/lib/quarters";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// The quarterly targets report to the Station Commander (John, Nov 2026):
// every WC/CC sends one each financial quarter — the "All watches" card on
// the References page puts it on each watch's board on its last tour of the
// quarter. Written from the same numbers as the target cards (same query
// keys, so it opens instantly), ready to email, with room for comments.

const STATION = "B10 Springburn";

export function QuarterReport({
  open, onOpenChange, watch, fq,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  watch: string;
  fq: FyQuarter;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const year = fq.start.getFullYear();
  const enabled = open && !!watch;

  const { data: hf } = useQuery({
    queryKey: ["activities", "hfsv", watch, fq.fy, fq.q],
    queryFn: () => backend.activity.list({ type: "hfsv", watch, financial_year: fq.fy, quarter: fq.q }),
    enabled,
  });
  const { data: cm } = useQuery({
    queryKey: ["activities", "community", watch, fq.fy, fq.q],
    queryFn: () => backend.activity.list({ type: "community", watch, financial_year: fq.fy, quarter: fq.q }),
    enabled,
  });
  const { data: ms } = useQuery({
    queryKey: ["assignments", "multistory", watch, fq.fy, fq.q],
    queryFn: () => backend.inspection_plans.listAssignments({ plan_type: "multistory", watch, year: fq.fy, quarter: fq.q }),
    enabled,
  });
  const { data: hy } = useQuery({
    queryKey: ["hydrants", "summary", year],
    queryFn: () => backend.hydrants.getHydrantSummary({ year }),
    enabled,
  });
  const loading = !hf || !cm || !ms || !hy;

  const past = quarterTime(fq).phase === "past";
  const gap = (n: number) => `${n} ${past ? "short" : "to go"}`;
  const status = (done: number, target: number) => (target > 0 && done >= target ? "target met" : gap(Math.max(0, target - done)));

  const hfDone = hf?.total_completed ?? 0;
  const cmDone = cm?.total_completed ?? 0;
  const tap = cm?.total_tap_completed ?? 0;
  const msDone = ms?.totals.complete ?? 0;
  const msTotal = msDone + (ms?.totals.pending ?? 0);
  const route = hy?.watches.find((w) => w.watch.toLowerCase() === watch.toLowerCase());
  const cmStatus = cmDone >= COMMUNITY_TARGET_Q && tap < COMMUNITY_TAP_MIN
    ? `TAP ${gap(COMMUNITY_TAP_MIN - tap)}`
    : status(cmDone, COMMUNITY_TARGET_Q);
  const asAt = new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  const text = [
    `Quarterly targets report — ${STATION}, ${watch} Watch`,
    `${fq.label} (${fq.months}) · as at ${asAt}`,
    "",
    `HFSV: ${hfDone} of ${HFSV_TARGET_Q} — ${status(hfDone, HFSV_TARGET_Q)}`,
    `Community engagement: ${cmDone} of ${COMMUNITY_TARGET_Q} (TAP ${tap} of ${COMMUNITY_TAP_MIN} minimum) — ${cmStatus}`,
    msTotal > 0
      ? `Multi-storey inspections: ${msDone} of ${msTotal} — ${status(msDone, msTotal)}`
      : "Multi-storey inspections: none allocated this quarter",
    route && route.total > 0
      ? `Hydrants (${year} route${route.label ? `, ${route.label}` : ""}): ${route.done} of ${route.total} inspected so far this year${route.faults ? ` · ${route.faults} not fully functional` : ""}`
      : `Hydrants: no ${year} route loaded`,
    "",
    "Comments:",
    "",
    "",
    [user?.name, user?.role ? `${user.role} ${watch} Watch` : `${watch} Watch`].filter(Boolean).join(", "),
  ].join("\n");
  const subject = `Quarterly targets report — ${STATION}, ${watch} Watch, ${fq.label}`;
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Report copied", description: "Paste it into your email to the SC." });
    } catch {
      toast({ title: "Couldn't copy — select the text and copy it instead", variant: "destructive" });
    }
  };
  const btn = "inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Quarterly targets report to the SC</DialogTitle>
          <DialogDescription>
            {watch} Watch · {fq.label} · {fq.months} — every target as it stands, ready to email. Add your comments in the email.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">Gathering the numbers…</p>
        ) : (
          <>
            <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed">{text}</pre>
            <div className="flex flex-wrap gap-2">
              <a href={mailto} className={`${btn} border-foreground/70 bg-foreground text-background hover:bg-foreground/90`}>
                <Mail className="h-4 w-4" /> Open in email
              </a>
              <button type="button" onClick={copy} className={btn}><Copy className="h-4 w-4" /> Copy</button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
