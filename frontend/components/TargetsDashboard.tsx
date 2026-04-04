import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import backend from "@/lib/backend";
import type { activity } from "@/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Target as TargetIcon, CheckCircle2, Plus, Trash2, Loader2,
  Home, Building2, Flame, Users,
} from "lucide-react";
import { useAuth } from "@/App";
import { useToast } from "@/components/ui/use-toast";

// ── Types ──────────────────────────────────────────────────────────────────

interface TargetsDashboardProps {
  periodStart?: string;
  periodEnd?: string;
  showPeriodSelector?: boolean;
  onPeriodChange?: (start: string, end: string) => void;
}

type ActivityRecord = activity.ActivityRecord;
type ActivityType = activity.ActivityType;

type MetricKey = "hfsv" | "multistory" | "hydrant" | "community";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Derive SFRS financial quarter from a calendar period start date. */
function toFinancialPeriod(
  periodStart: string,
  periodEnd: string,
): { financial_year: number; quarter: number | null } | null {
  if (!periodStart) return null;
  const start = new Date(periodStart + "T00:00:00");
  const end = new Date((periodEnd || periodStart) + "T00:00:00");
  const m = start.getMonth();
  const y = start.getFullYear();

  const daySpan = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (daySpan > 95) return { financial_year: y, quarter: null }; // full year

  if (m >= 3 && m <= 5) return { financial_year: y, quarter: 1 };
  if (m >= 6 && m <= 8) return { financial_year: y, quarter: 2 };
  if (m >= 9 && m <= 11) return { financial_year: y, quarter: 3 };
  return { financial_year: y - 1, quarter: 4 }; // Jan-Mar
}

/** Derive calendar year + quarter from a period start date. */
function toCalendarPeriod(periodStart: string, periodEnd: string) {
  if (!periodStart) return { year: new Date().getFullYear(), quarter: null as number | null };
  const d = new Date(periodStart + "T00:00:00");
  const y = d.getFullYear();
  const startMonth = d.getMonth();
  const endMonth = periodEnd ? new Date(periodEnd + "T00:00:00").getMonth() : 11;
  if (startMonth === 0 && endMonth === 11) return { year: y, quarter: null };
  return { year: y, quarter: Math.floor(startMonth / 3) + 1 };
}

// ── Activity Drawer (HFSV / Community) ─────────────────────────────────────

function ActivityDrawer({
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
    onSuccess: () => qc.invalidateQueries({ queryKey: actKey }),
    onError: () => toast({ title: "Error", description: "Failed to seed HFSV records", variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: (id: number) => backend.activity.toggle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: actKey });
      qc.invalidateQueries({ queryKey: ["activities"] }); // refresh metric cards
    },
    onError: () => toast({ title: "Error", description: "Failed to update record", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...fields }: { id: number; address?: string; title?: string; engagement_date?: string; details?: string }) =>
      backend.activity.update(id, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: actKey }),
  });

  const createMut = useMutation({
    mutationFn: (req: { type: ActivityType; watch: string; financial_year: number; quarter: number; title?: string }) =>
      backend.activity.create(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: actKey });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to create record", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => backend.activity.remove({ id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: actKey });
      qc.invalidateQueries({ queryKey: ["activities"] });
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

// ── Main component ─────────────────────────────────────────────────────────

export default function TargetsDashboard({
  periodStart,
  periodEnd,
}: TargetsDashboardProps) {
  const [openDrawer, setOpenDrawer] = useState<ActivityType | null>(null);
  const { user } = useAuth();
  const userWatch = user?.watch_unit ?? "";

  const activePeriodStart = periodStart || new Date().toISOString().split("T")[0];
  const activePeriodEnd = periodEnd || activePeriodStart;

  // Derive the financial quarter (for activity_records: HFSV, community)
  const financialPeriod = useMemo(
    () => toFinancialPeriod(activePeriodStart, activePeriodEnd),
    [activePeriodStart, activePeriodEnd]
  );

  // Derive the calendar year + quarter (for inspection_assignments: multistory, hydrant)
  const calPeriod = useMemo(
    () => toCalendarPeriod(activePeriodStart, activePeriodEnd),
    [activePeriodStart, activePeriodEnd]
  );

  // ── Fetch HFSV activity records ──────────────────────────────────────────
  const { data: hfsvData, isFetching: hfsvFetching } = useQuery({
    queryKey: ["activities", "hfsv", userWatch, financialPeriod?.financial_year, financialPeriod?.quarter],
    queryFn: () =>
      backend.activity.list({
        type: "hfsv",
        watch: userWatch || undefined,
        financial_year: financialPeriod?.financial_year ?? undefined,
        quarter: financialPeriod?.quarter ?? undefined,
      }),
    enabled: !!financialPeriod,
    // Don't retry on failure — show 0 immediately if activity service is unreachable
    retry: false,
  });

  // ── Fetch community engagement activity records ──────────────────────────
  const { data: communityData, isFetching: communityFetching } = useQuery({
    queryKey: ["activities", "community", userWatch, financialPeriod?.financial_year, financialPeriod?.quarter],
    queryFn: () =>
      backend.activity.list({
        type: "community",
        watch: userWatch || undefined,
        financial_year: financialPeriod?.financial_year ?? undefined,
        quarter: financialPeriod?.quarter ?? undefined,
      }),
    enabled: !!financialPeriod,
    retry: false,
  });

  // ── Fetch multi-story inspection assignments ─────────────────────────────
  const { data: multiStoryData, isFetching: multiStoryFetching } = useQuery({
    queryKey: ["assignments", "multistory", userWatch, calPeriod.year, calPeriod.quarter],
    queryFn: () =>
      backend.inspection_plans.listAssignments({
        plan_type: "multistory",
        watch: userWatch || undefined,
        year: calPeriod.year,
        quarter: calPeriod.quarter ?? undefined,
      }),
    retry: false,
  });

  // ── Fetch hydrant inspection assignments ─────────────────────────────────
  const { data: hydrantData, isFetching: hydrantFetching } = useQuery({
    queryKey: ["assignments", "hydrant", userWatch, calPeriod.year],
    queryFn: () =>
      backend.inspection_plans.listAssignments({
        plan_type: "hydrant",
        watch: userWatch || undefined,
        year: calPeriod.year,
        quarter: 0, // annual
      }),
    retry: false,
  });

  // ── Build metric data from live sources ──────────────────────────────────
  const metrics = useMemo(() => {
    const hfsvComplete = hfsvData?.total_completed ?? 0;
    const hfsvTotal = 36; // Fixed target

    const communityComplete = communityData?.total_completed ?? 0;
    const communityTotal = 6; // Fixed target

    const msComplete = multiStoryData?.totals?.complete ?? 0;
    const msTotal = (multiStoryData?.totals?.pending ?? 0) + msComplete;

    const hydrantComplete = hydrantData?.totals?.complete ?? 0;
    const hydrantTotal = (hydrantData?.totals?.pending ?? 0) + hydrantComplete;

    return [
      {
        key: "hfsv" as MetricKey,
        label: "Home Fire Safety Visits",
        icon: Home,
        iconColor: "text-red-500",
        target: hfsvTotal,
        actual: hfsvComplete,
        isFetching: hfsvFetching,
        clickable: true,
        drawerType: "hfsv" as ActivityType,
      },
      {
        key: "multistory" as MetricKey,
        label: "Multi-Story Inspections",
        icon: Building2,
        iconColor: "text-blue-500",
        target: msTotal,
        actual: msComplete,
        isFetching: multiStoryFetching,
        clickable: false,
        subtitle: "Managed in Inspection Assignments below",
      },
      {
        key: "hydrant" as MetricKey,
        label: "Hydrant Inspections",
        icon: Flame,
        iconColor: "text-orange-500",
        target: hydrantTotal,
        actual: hydrantComplete,
        isFetching: hydrantFetching,
        clickable: false,
        subtitle: "Managed via Hydrant Register below",
      },
      {
        key: "community" as MetricKey,
        label: "Community Engagement",
        icon: Users,
        iconColor: "text-purple-500",
        target: communityTotal,
        actual: communityComplete,
        isFetching: communityFetching,
        clickable: true,
        drawerType: "community" as ActivityType,
      },
    ];
  }, [hfsvData, communityData, multiStoryData, hydrantData, hfsvFetching, communityFetching, multiStoryFetching, hydrantFetching]);

  // ── Overall stats ────────────────────────────────────────────────────────
  const overallStats = useMemo(() => {
    const totalTarget = metrics.reduce((sum, m) => sum + m.target, 0);
    const totalActual = metrics.reduce((sum, m) => sum + m.actual, 0);
    const pct = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
    return { totalTarget, totalActual, pct };
  }, [metrics]);

  // ── Status helpers ───────────────────────────────────────────────────────
  const getStatusBadge = (pct: number) => {
    if (pct >= 100) return <Badge className="bg-green-500/10 text-green-500">completed</Badge>;
    if (pct >= 75) return <Badge className="bg-blue-500/10 text-blue-500">on track</Badge>;
    if (pct >= 40) return <Badge className="bg-yellow-500/10 text-yellow-500">in progress</Badge>;
    return <Badge className="bg-red-500/10 text-red-500">action needed</Badge>;
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 100) return "bg-green-500";
    if (pct >= 75) return "bg-blue-500";
    if (pct >= 40) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-6">
      {/* ── Overall progress bar ────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TargetIcon className="h-5 w-5" />
              Overall Progress
            </CardTitle>
            <span className="text-sm font-semibold">
              {overallStats.totalActual} / {overallStats.totalTarget}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getProgressColor(overallStats.pct)}`}
              style={{ width: `${Math.min(overallStats.pct, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">{overallStats.pct.toFixed(1)}% complete</p>
        </CardContent>
      </Card>

      {/* ── Metric cards ────────────────────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2">
        {metrics.map((m) => {
          const pct = m.target > 0 ? (m.actual / m.target) * 100 : 0;

          return (
            <Card
              key={m.key}
              className={m.clickable ? "cursor-pointer hover:border-indigo-400/60 transition-colors" : ""}
              onClick={() => m.clickable && m.drawerType && setOpenDrawer(m.drawerType)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <m.icon className={`h-5 w-5 ${m.iconColor}`} />
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {m.label}
                        {m.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {m.actual} / {m.target} complete
                        {m.clickable && (
                          <span className="ml-2 text-xs text-red-500 font-medium">Click to manage →</span>
                        )}
                        {!m.clickable && m.subtitle && (
                          <span className="ml-1 text-xs text-muted-foreground">• {m.subtitle}</span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(pct)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getProgressColor(pct)}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold">{pct.toFixed(1)}%</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Remaining</span>
                    <span className="font-medium">{Math.max(0, m.target - m.actual)}</span>
                  </div>

                  {pct >= 100 && (
                    <div className="flex items-center gap-2 text-sm text-green-500">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Target achieved!</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Activity drawers ────────────────────────────────────────────── */}
      {openDrawer && financialPeriod && (
        <ActivityDrawer
          type={openDrawer}
          watch={userWatch}
          financial_year={financialPeriod.financial_year}
          quarter={financialPeriod.quarter ?? 1}
          open={!!openDrawer}
          onClose={() => setOpenDrawer(null)}
        />
      )}
    </div>
  );
}
