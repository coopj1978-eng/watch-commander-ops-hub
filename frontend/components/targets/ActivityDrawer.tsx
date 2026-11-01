import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateTargetViews } from "@/lib/targetsCache";
import backend from "@/lib/backend";
import type { activity } from "@/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "@/App";
import { useToast } from "@/components/ui/use-toast";
import { COMMUNITY_TAP_MIN } from "@/lib/targets";

// Every HFSV slot / community engagement for one watch and quarter, editable
// by WCs and CCs. Opened from the Targets page cards ("All 36 visits",
// "Manage"). Shares its query with the cards, so edits show everywhere.

type ActivityRecord = activity.ActivityRecord;
type ActivityType = activity.ActivityType;

export function ActivityDrawer({
  type, watch, financial_year, quarter, open, onClose,
}: {
  type: ActivityType; watch: string; financial_year: number;
  quarter: number | null; open: boolean; onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const auth = useAuth();
  const isWCOrCC = auth.user?.role === "WC" || auth.user?.role === "CC";

  const actKey = ["activities", type, watch, financial_year, quarter];

  const { data, isLoading } = useQuery({
    queryKey: actKey,
    queryFn: () =>
      backend.activity.list({
        type,
        watch: watch || undefined,
        financial_year: financial_year || undefined,
        quarter: quarter || undefined,
      }),
    enabled: open,
  });

  const items: ActivityRecord[] = data?.items ?? [];

  const seedMut = useMutation({
    mutationFn: () =>
      backend.activity.seedHfsv({ watch, financial_year, quarter: quarter! }),
    onSuccess: () => invalidateTargetViews(qc),
    onError: () => toast({ title: "Error", description: "Failed to seed HFSV records", variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: (id: number) => backend.activity.toggle(id),
    onSuccess: () => {
      invalidateTargetViews(qc); // every card, Year at a Glance and the dashboard
    },
    onError: () => toast({ title: "Error", description: "Failed to update record", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...fields }: { id: number; address?: string; title?: string; engagement_date?: string; details?: string; is_tap?: boolean }) =>
      backend.activity.update(id, fields),
    onSuccess: () => {
      invalidateTargetViews(qc); // every card, Year at a Glance and the dashboard
    },
  });

  const createMut = useMutation({
    mutationFn: (req: { type: ActivityType; watch: string; financial_year: number; quarter: number; title?: string }) =>
      backend.activity.create(req),
    onSuccess: () => {
      invalidateTargetViews(qc); // every card, Year at a Glance and the dashboard
    },
    onError: () => toast({ title: "Error", description: "Failed to create record", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => backend.activity.remove(id),
    onSuccess: () => {
      invalidateTargetViews(qc); // every card, Year at a Glance and the dashboard
    },
    onError: () => toast({ title: "Error", description: "Failed to delete record", variant: "destructive" }),
  });

  const completed = items.filter(i => i.completed).length;
  const total = items.length;

  const titles: Record<ActivityType, string> = {
    hfsv: "Home Fire Safety Visits (HFSV)",
    hydrant: "Hydrant Inspections",
    community: "Community Engagement",
  };

  const quarterLabel = quarter
    ? `Q${quarter} ${financial_year}/${String(financial_year + 1).slice(2)}`
    : `${financial_year}/${String(financial_year + 1).slice(2)}`;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>{titles[type]}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {watch} Watch — {quarterLabel} — {completed} / {total} complete
            {type === "community" && (
              <> · TAP {items.filter(i => i.completed && i.is_tap).length} / {COMMUNITY_TAP_MIN} minimum</>
            )}
          </p>
          {total > 0 && (
            <Progress value={(completed / total) * 100} className="h-1.5 mt-2" />
          )}
        </DialogHeader>

        {/* ── HFSV ─────────────────────────────────────────────────────── */}
        {type === "hfsv" && (
          <div className="flex-1 overflow-y-auto pr-1 space-y-1">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : items.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm text-muted-foreground mb-4">
                  No HFSV records for this quarter yet.
                </p>
                {isWCOrCC && quarter && (
                  <Button size="sm" onClick={() => seedMut.mutate()} disabled={seedMut.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                    {seedMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                    Set Up 36 HFSV Records
                  </Button>
                )}
              </div>
            ) : (
              items.map(item => (
                <div key={item.id} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
                  <Checkbox checked={item.completed} disabled={toggleMut.isPending || !isWCOrCC} onCheckedChange={() => toggleMut.mutate(item.id)} />
                  <span className={`text-sm font-medium w-14 shrink-0 ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                    HFSV #{item.item_number}
                  </span>
                  <Input
                    placeholder="Address (optional)" className="h-7 text-xs" defaultValue={item.address ?? ""} disabled={!isWCOrCC}
                    onBlur={e => { if (e.target.value !== (item.address ?? "")) updateMut.mutate({ id: item.id, address: e.target.value }); }}
                  />
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Community Engagement ─────────────────────────────────────── */}
        {type === "community" && (
          <div className="flex-1 overflow-y-auto pr-1 space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                {items.map(item => (
                  <div key={item.id} className="border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Checkbox checked={item.completed} disabled={toggleMut.isPending || !isWCOrCC} onCheckedChange={() => toggleMut.mutate(item.id)} className="mt-0.5" />
                      <div className="flex-1 space-y-2">
                        <Input placeholder="Engagement name" className="h-7 text-sm" defaultValue={item.title ?? ""} disabled={!isWCOrCC}
                          onBlur={e => { if (e.target.value !== (item.title ?? "")) updateMut.mutate({ id: item.id, title: e.target.value }); }} />
                        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer w-fit">
                          <Checkbox
                            checked={item.is_tap}
                            disabled={updateMut.isPending || !isWCOrCC}
                            onCheckedChange={(v) => updateMut.mutate({ id: item.id, is_tap: v === true })}
                          />
                          TAP engagement
                        </label>
                        <Input type="date" className="h-7 text-sm"
                          defaultValue={item.engagement_date ? new Date(item.engagement_date).toISOString().split("T")[0] : ""} disabled={!isWCOrCC}
                          onBlur={e => {
                            const val = e.target.value;
                            const existing = item.engagement_date ? new Date(item.engagement_date).toISOString().split("T")[0] : "";
                            if (val !== existing) updateMut.mutate({ id: item.id, engagement_date: val || undefined });
                          }} />
                        <Textarea placeholder="Additional details..." className="text-xs resize-none" rows={2} defaultValue={item.details ?? ""} disabled={!isWCOrCC}
                          onBlur={e => { if (e.target.value !== (item.details ?? "")) updateMut.mutate({ id: item.id, details: e.target.value }); }} />
                      </div>
                      {isWCOrCC && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-600" disabled={deleteMut.isPending}
                          onClick={() => deleteMut.mutate(item.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No community engagements added yet.</p>
                )}
                {isWCOrCC && quarter && (
                  <Button variant="outline" size="sm" className="mt-2 w-full gap-2" disabled={createMut.isPending}
                    onClick={() => createMut.mutate({ type: "community", watch, financial_year, quarter })}>
                    <Plus className="h-3.5 w-3.5" /> Add Community Engagement
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

