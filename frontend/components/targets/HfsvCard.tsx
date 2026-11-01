import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Home, Loader2, Plus } from "lucide-react";
import backend from "@/lib/backend";
import { invalidateTargetViews } from "@/lib/targetsCache";
import { HFSV_TARGET_Q } from "@/lib/targets";
import { pace as paceOf, quarterTime, shiftsLeft, type FyQuarter } from "@/lib/quarters";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActivityDrawer } from "./ActivityDrawer";
import { PaceLines, PacePill, TargetCard, TargetRing } from "./TargetParts";

// Home fire safety visits: 36 a quarter, kept as numbered slots. "Log a
// visit" ticks the next open slot (with an optional address) in one go, so
// nobody scrolls a list of 36 to find it; Undo puts it back.

export function HfsvCard({ watch, fq, canEdit }: { watch: string; fq: FyQuarter; canEdit: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [logging, setLogging] = useState(false);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [drawer, setDrawer] = useState(false);

  const params = { type: "hfsv" as const, watch: watch || undefined, financial_year: fq.fy, quarter: fq.q };
  const { data, isLoading } = useQuery({
    queryKey: ["activities", "hfsv", watch, fq.fy, fq.q],
    queryFn: () => backend.activity.list(params),
    enabled: !!watch,
  });

  const items = data?.items ?? [];
  const done = data?.total_completed ?? items.filter((i) => i.completed).length;
  const time = quarterTime(fq);
  const p = paceOf(done, HFSV_TARGET_Q, time.elapsed, time.phase);
  const shifts = time.phase === "past" ? null : shiftsLeft(watch, fq);
  const recent = items
    .filter((i) => i.completed)
    .sort((a, b) => String(b.completed_at ?? "").localeCompare(String(a.completed_at ?? "")))
    .slice(0, 3);

  const logVisit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      let slots = items;
      if (slots.length === 0) {
        await backend.activity.seedHfsv({ watch, financial_year: fq.fy, quarter: fq.q });
        slots = (await backend.activity.list(params)).items ?? [];
      }
      const next = slots.filter((i) => !i.completed).sort((a, b) => (a.item_number ?? 0) - (b.item_number ?? 0))[0];
      if (!next) {
        toast({ title: "All 36 visits are already logged" });
        return;
      }
      const typed = address.trim();
      const before = next.address ?? "";
      await backend.activity.toggle(next.id);
      if (typed) await backend.activity.update(next.id, { address: typed });
      await invalidateTargetViews(qc);
      setAddress("");
      setLogging(false);
      toast({
        title: `HFSV #${next.item_number} logged`,
        description: typed || undefined,
        action: (
          <ToastAction
            altText="Undo"
            onClick={async () => {
              // Put the slot back as it was — unticked, with its old address.
              await backend.activity.toggle(next.id);
              if (typed) await backend.activity.update(next.id, { address: before });
              invalidateTargetViews(qc);
            }}
          >
            Undo
          </ToastAction>
        ),
      });
    } catch {
      toast({ title: "Couldn't log the visit", description: "Check your connection and try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TargetCard
        icon={<Home className="h-[18px] w-[18px]" />}
        title="Home fire safety visits"
        subtitle={`${HFSV_TARGET_Q} a quarter · ${fq.months}`}
        pill={<PacePill state={p.state} />}
        ring={
          <TargetRing actual={done} target={HFSV_TARGET_Q} pace={p}>
            <div>
              <div className="font-mono text-3xl font-semibold tabular-nums leading-none">{isLoading ? "…" : done}</div>
              <div className="mt-1 text-xs text-muted-foreground">of {HFSV_TARGET_Q}</div>
            </div>
          </TargetRing>
        }
        footer={
          <>
            {canEdit && time.phase !== "future" && !logging && (
              <Button size="sm" onClick={() => setLogging(true)} className="bg-brand text-brand-foreground hover:bg-brand/90">
                <Plus className="mr-1 h-4 w-4" /> Log a visit
              </Button>
            )}
            {logging && (
              <form
                className="flex w-full flex-wrap items-center gap-2"
                onSubmit={(e) => { e.preventDefault(); logVisit(); }}
              >
                <Input
                  autoFocus
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") setLogging(false); }}
                  placeholder="Address (optional)"
                  className="h-9 min-w-0 flex-1"
                />
                <Button type="submit" size="sm" disabled={busy} className="bg-brand text-brand-foreground hover:bg-brand/90">
                  {busy && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />} Log
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setLogging(false)}>Cancel</Button>
              </form>
            )}
            {!logging && (
              <button onClick={() => setDrawer(true)} className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground">
                All {items.length || HFSV_TARGET_Q} visits →
              </button>
            )}
          </>
        }
      >
        <PaceLines pace={p} noun="visits" shifts={shifts} watch={watch} />
        {recent.length > 0 && (
          <ul className="mt-4 space-y-1.5 border-t border-border/60 pt-3">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-muted-foreground">#{r.item_number}</span>
                <span className="min-w-0 flex-1 truncate">{r.address || <span className="text-muted-foreground">No address</span>}</span>
                {r.completed_at && (
                  <span className="shrink-0 text-muted-foreground">
                    {new Date(r.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </TargetCard>
      {drawer && (
        <ActivityDrawer type="hfsv" watch={watch} financial_year={fq.fy} quarter={fq.q} open={drawer} onClose={() => setDrawer(false)} />
      )}
    </>
  );
}
