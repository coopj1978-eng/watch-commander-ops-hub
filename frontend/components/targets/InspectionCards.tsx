import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Building2, Check, Flame } from "lucide-react";
import backend from "@/lib/backend";
import { cn } from "@/lib/utils";
import { invalidateTargetViews } from "@/lib/targetsCache";
import { pace as paceOf, quarterTime, shiftsLeft, type FyQuarter } from "@/lib/quarters";
import { useToast } from "@/components/ui/use-toast";
import { PaceLines, PacePill, TargetCard, TargetRing } from "./TargetParts";

// Multi-story and hydrant targets. Multi-story buildings come from the
// inspection plan for this watch and financial quarter, ticked right here (the
// only place they're listed). The hydrant route is annual, by calendar year,
// and ticked in Annual inspections below.

export function MultiStoryCard({ watch, fq, canEdit }: { watch: string; fq: FyQuarter; canEdit: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["assignments", "multistory", watch, fq.fy, fq.q],
    queryFn: () =>
      backend.inspection_plans.listAssignments({ plan_type: "multistory", watch: watch || undefined, year: fq.fy, quarter: fq.q }),
    enabled: !!watch,
  });
  const items = [...(data?.items ?? [])].sort((a, b) => a.label.localeCompare(b.label));
  const done = items.filter((i) => i.status === "complete").length;
  const total = items.length;
  const time = quarterTime(fq);
  const p = paceOf(done, total, time.elapsed, time.phase);
  const shifts = time.phase === "past" ? null : shiftsLeft(watch, fq);

  const toggle = useMutation({
    mutationFn: (it: { id: number; status: string }) =>
      backend.inspection_plans.updateAssignment(it.id, { status: it.status === "complete" ? "pending" : "complete" }),
    onSuccess: () => invalidateTargetViews(qc),
    onError: () => toast({ title: "Couldn't update the inspection", variant: "destructive" }),
  });

  return (
    <TargetCard
      icon={<Building2 className="h-[18px] w-[18px]" />}
      title="Multi-story inspections"
      subtitle={`From the inspection plan · ${fq.months}`}
      pill={<PacePill state={p.state} label={total === 0 && !isLoading ? "None this quarter" : undefined} />}
      ring={
        <TargetRing actual={done} target={total} pace={p}>
          <div>
            <div className="font-mono text-3xl font-semibold tabular-nums leading-none">{isLoading ? "…" : done}</div>
            <div className="mt-1 text-xs text-muted-foreground">of {total}</div>
          </div>
        </TargetRing>
      }
    >
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Loading…" : `No multi-story buildings for ${watch} Watch in ${fq.months}.`}
        </p>
      ) : (
        <>
          <PaceLines pace={p} noun="buildings" shifts={shifts} watch={watch} />
          <ul className="mt-4 grid gap-1 border-t border-border/60 pt-3 sm:grid-cols-2">
            {items.map((it) => {
              const complete = it.status === "complete";
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    disabled={!canEdit || toggle.isPending}
                    onClick={() => toggle.mutate(it)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                      canEdit && "hover:bg-muted/60",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-5 w-5 shrink-0 place-items-center rounded-md border",
                        complete ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40",
                      )}
                    >
                      {complete && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                    <span className={cn("truncate", complete && "text-muted-foreground line-through")}>{it.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </TargetCard>
  );
}

export function HydrantCard({ watch, fq, canEdit }: { watch: string; fq: FyQuarter; canEdit: boolean }) {
  // The route is per calendar year — the one this quarter falls in.
  const year = fq.start.getFullYear();
  const { data, isLoading } = useQuery({
    queryKey: ["assignments", "hydrant", watch, year],
    queryFn: () =>
      backend.inspection_plans.listAssignments({ plan_type: "hydrant", watch: watch || undefined, year, quarter: 0 }),
    enabled: !!watch,
  });
  const done = data?.totals?.complete ?? 0;
  const total = done + (data?.totals?.pending ?? 0);

  // Pace over the calendar year.
  const now = new Date();
  const yStart = new Date(year, 0, 1);
  const yEnd = new Date(year, 11, 31);
  const phase = now < yStart ? "future" : now > yEnd ? "past" : "now";
  const elapsed = phase === "now" ? (now.getTime() - yStart.getTime()) / (yEnd.getTime() - yStart.getTime()) : phase === "past" ? 1 : 0;
  const p = paceOf(done, total, elapsed, phase);

  return (
    <TargetCard
      icon={<Flame className="h-[18px] w-[18px]" />}
      title="Hydrant inspections"
      subtitle={`Annual route · ${year}`}
      pill={<PacePill state={p.state} label={total === 0 && !isLoading ? "No route" : undefined} />}
      ring={
        <TargetRing actual={done} target={total} pace={p}>
          <div>
            <div className="font-mono text-3xl font-semibold tabular-nums leading-none">{isLoading ? "…" : done}</div>
            <div className="mt-1 text-xs text-muted-foreground">of {total}</div>
          </div>
        </TargetRing>
      }
    >
      {total === 0 ? (
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            {isLoading ? "Loading…" : `No ${year} hydrant route for ${watch} Watch yet. The target comes from the route — however many hydrants it has.`}
          </p>
          {canEdit && !isLoading && (
            <Link to="/settings?tab=inspection-plans" className="inline-block text-xs font-medium text-brand hover:underline">
              Add the route in Settings → Inspection plans →
            </Link>
          )}
        </div>
      ) : (
        <>
          <PaceLines pace={p} noun="hydrants" shifts={null} watch={watch} />
          <p className="mt-3 text-xs text-muted-foreground">Tick hydrants in Annual inspections below.</p>
        </>
      )}
    </TargetCard>
  );
}
