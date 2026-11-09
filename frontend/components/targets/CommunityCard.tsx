import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Users } from "lucide-react";
import backend from "@/lib/backend";
import { cn } from "@/lib/utils";
import { invalidateTargetViews } from "@/lib/targetsCache";
import { COMMUNITY_TAP_MIN, COMMUNITY_TARGET_Q, thisMonth } from "@/lib/targets";
import { pace as paceOf, quarterTime, type FyQuarter } from "@/lib/quarters";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { ActivityDrawer } from "./ActivityDrawer";
import { MonthLine, PaceLines, PacePill, TargetCard, TargetRing } from "./TargetParts";

// Community engagement: 6 a quarter, at least 3 of them TAP. The card lists
// the quarter's engagements with a one-tap "done" tick; details (name, date,
// TAP, notes) are edited in the drawer.

export function CommunityCard({ watch, fq, canEdit }: { watch: string; fq: FyQuarter; canEdit: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [drawer, setDrawer] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["activities", "community", watch, fq.fy, fq.q],
    queryFn: () => backend.activity.list({ type: "community", watch: watch || undefined, financial_year: fq.fy, quarter: fq.q }),
    enabled: !!watch,
  });
  const items = data?.items ?? [];
  const done = data?.total_completed ?? items.filter((i) => i.completed).length;
  const tap = data?.total_tap_completed ?? items.filter((i) => i.completed && i.is_tap).length;

  const time = quarterTime(fq);
  const p = paceOf(done, COMMUNITY_TARGET_Q, time.elapsed, time.phase, tap >= COMMUNITY_TAP_MIN);

  const toggle = useMutation({
    mutationFn: (id: number) => backend.activity.toggle(id),
    onSuccess: () => invalidateTargetViews(qc),
    onError: () => toast({ title: "Couldn't update the engagement", variant: "destructive" }),
  });
  const add = useMutation({
    mutationFn: () => backend.activity.create({ type: "community", watch, financial_year: fq.fy, quarter: fq.q }),
    onSuccess: () => { invalidateTargetViews(qc); setDrawer(true); },
    onError: () => toast({ title: "Couldn't add an engagement", variant: "destructive" }),
  });

  return (
    <>
      <TargetCard
        reference={5}
        icon={<Users className="h-[18px] w-[18px]" />}
        title="Community engagement"
        subtitle={`${COMMUNITY_TARGET_Q} a quarter, ${COMMUNITY_TAP_MIN}+ TAP · ${fq.months}`}
        pill={<PacePill state={p.state} label={p.state === "done" ? "Done" : done >= COMMUNITY_TARGET_Q && tap < COMMUNITY_TAP_MIN ? "Needs TAP" : undefined} />}
        ring={
          <TargetRing actual={done} target={COMMUNITY_TARGET_Q} pace={p}>
            <div>
              <div className="font-mono text-3xl font-semibold tabular-nums leading-none">{isLoading ? "…" : done}</div>
              <div className="mt-1 text-xs text-muted-foreground">of {COMMUNITY_TARGET_Q}</div>
            </div>
          </TargetRing>
        }
        footer={
          <>
            {canEdit && time.phase !== "future" && (
              <Button size="sm" variant="outline" disabled={add.isPending} onClick={() => add.mutate()}>
                <Plus className="mr-1 h-4 w-4" /> Add engagement
              </Button>
            )}
            <button onClick={() => setDrawer(true)} className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground">
              Details →
            </button>
          </>
        }
      >
        {/* TAP minimum as three pips */}
        <div className="mb-3 flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">TAP</span>
          {Array.from({ length: COMMUNITY_TAP_MIN }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                i < tap ? "bg-emerald-500" : time.phase === "past" ? "bg-red-400" : "border border-muted-foreground/40",
              )}
            />
          ))}
          <span className="font-mono tabular-nums text-muted-foreground">{tap}/{COMMUNITY_TAP_MIN}</span>
        </div>
        {time.phase === "now" && (
          <MonthLine
            {...thisMonth(items.filter((i) => i.completed).map((i) => i.engagement_date ?? i.completed_at), COMMUNITY_TARGET_Q)}
            noun={["engagement", "engagements"]}
          />
        )}
        <PaceLines pace={p} noun="engagements" shifts={null} watch={watch} />
        {items.length > 0 && (
          <ul className="mt-4 space-y-1 border-t border-border/60 pt-3">
            {items.slice(0, 6).map((it) => (
              <li key={it.id} className="flex items-center gap-2.5 text-sm">
                <button
                  type="button"
                  disabled={!canEdit || toggle.isPending}
                  onClick={() => toggle.mutate(it.id)}
                  aria-label={it.completed ? "Mark not done" : "Mark done"}
                  className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors",
                    it.completed ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40 hover:border-foreground",
                  )}
                >
                  {it.completed && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </button>
                <span className={cn("min-w-0 flex-1 truncate", it.completed && "text-muted-foreground line-through")}>
                  {it.title || "Untitled engagement"}
                </span>
                {it.is_tap && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">TAP</span>}
                {it.engagement_date && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(it.engagement_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </TargetCard>
      {drawer && (
        <ActivityDrawer type="community" watch={watch} financial_year={fq.fy} quarter={fq.q} open={drawer} onClose={() => setDrawer(false)} />
      )}
    </>
  );
}
