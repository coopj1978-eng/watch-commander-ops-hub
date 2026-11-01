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
// and ticked hydrant by hydrant on the Hydrants page.

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

export function HydrantCard({ watch, fq }: { watch: string; fq: FyQuarter }) {
  // The route is per calendar year — the one this quarter falls in — and
  // comes from the station's rota and route sheets (pages/Hydrants.tsx).
  const year = fq.start.getFullYear();
  const { data, isLoading } = useQuery({
    queryKey: ["hydrants", "summary", year],
    queryFn: () => backend.hydrants.getHydrantSummary({ year }),
    enabled: !!watch,
  });
  const mine = data?.watches.find((w) => w.watch.toLowerCase() === watch.toLowerCase());
  const done = mine?.done ?? 0;
  const total = mine?.total ?? 0;

  // Pace over the calendar year.
  const now = new Date();
  const yStart = new Date(year, 0, 1);
  const yEnd = new Date(year, 11, 31);
  const phase = now < yStart ? "future" : now > yEnd ? "past" : "now";
  const elapsed = phase === "now" ? (now.getTime() - yStart.getTime()) / (yEnd.getTime() - yStart.getTime()) : phase === "past" ? 1 : 0;
  const p = paceOf(done, total, elapsed, phase);
  const link = `/hydrants?watch=${encodeURIComponent(watch)}&year=${year}`;

  return (
    <TargetCard
      icon={<Flame className="h-[18px] w-[18px]" />}
      title="Hydrant inspections"
      subtitle={mine ? `${mine.label} · ${year} route` : `Annual route · ${year}`}
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
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Loading…" : data?.loaded ? `No hydrants on ${watch} Watch's ${year} route.` : "The hydrant routes haven't been loaded yet."}
        </p>
      ) : (
        <>
          <PaceLines pace={p} noun="hydrants" shifts={null} watch={watch} />
          {!!mine?.faults && (
            <p className="mt-2 text-sm font-medium text-red-700 dark:text-red-300">{mine.faults} not fully functional — fault report on the route</p>
          )}
        </>
      )}
      <Link to={link} className="mt-3 inline-block text-sm font-medium text-brand hover:underline">Open the route →</Link>
    </TargetCard>
  );
}
