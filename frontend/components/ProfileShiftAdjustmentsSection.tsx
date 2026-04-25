import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/App";
import { useUserRole } from "@/lib/rbac";
import backend from "@/lib/backend";
import { useToast } from "@/components/ui/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays,
  ArrowLeftRight,
  GraduationCap,
  Trash2,
  RefreshCw,
  Sun,
  Clock,
  AlertTriangle,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────────
// ProfileShiftAdjustmentsSection
//
// Lists all shift adjustments (Flexi / Training / H4H / TOIL / Flexi Payback
// / Orange Day) for the profile owner, with delete buttons gated to the
// owner or any WC/CC. Used to back out an erroneous adjustment so it can be
// recreated cleanly — particularly useful for legacy TOIL/H4H entries
// created before the Day/Night picker shipped (those entries have
// shift_day_night = NULL and spread across two calendar dates for night
// shifts; deleting + recreating fixes the calendar display + properly
// debits the TOIL ledger).
//
// View permission matches the parent gate on the ProfileDetail tab —
// owner OR any WC/CC.
// ──────────────────────────────────────────────────────────────────────────────

const TYPE_STYLE: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
    border: string;
  }
> = {
  flexi: {
    label: "Flexi Day",
    icon: CalendarDays,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-300 dark:border-amber-700",
  },
  training: {
    label: "Training",
    icon: GraduationCap,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-300 dark:border-blue-700",
  },
  h4h: {
    label: "Head for Head",
    icon: ArrowLeftRight,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    border: "border-purple-300 dark:border-purple-700",
  },
  flexi_payback: {
    label: "Flexi Payback",
    icon: RefreshCw,
    color: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-950/40",
    border: "border-teal-300 dark:border-teal-700",
  },
  orange_day: {
    label: "Orange Day",
    icon: Sun,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    border: "border-orange-300 dark:border-orange-700",
  },
  toil: {
    label: "TOIL",
    icon: Clock,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-300 dark:border-emerald-700",
  },
};

const fmtDate = (d: string) =>
  format(parseISO(String(d).split("T")[0]), "d MMM yyyy");

export interface ProfileShiftAdjustmentsSectionProps {
  profileUserId: string;
}

export function ProfileShiftAdjustmentsSection({
  profileUserId,
}: ProfileShiftAdjustmentsSectionProps) {
  const { user } = useAuth();
  const role = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isOwn = user?.id === profileUserId;
  const isManager = role === "WC" || role === "CC";
  const canManage = isOwn || isManager;

  const [showAll, setShowAll] = useState(false);

  const adjustmentsQ = useQuery({
    queryKey: ["shift-adjustments-for-profile", profileUserId],
    queryFn: () =>
      backend.shift_adjustments.list({
        user_id: profileUserId,
        // No date filter — return everything so legacy entries are
        // visible and can be cleaned up.
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => backend.shift_adjustments.deleteAdjustment(id),
    onSuccess: () => {
      // Invalidate every cache that touches shift adjustments + their
      // downstream effects (TOIL balance, calendar events, crewing).
      queryClient.invalidateQueries({ queryKey: ["shift-adjustments-for-profile"] });
      queryClient.invalidateQueries({ queryKey: ["shift-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["shift-adjustments-mine"] });
      queryClient.invalidateQueries({ queryKey: ["toil-balance"] });
      queryClient.invalidateQueries({ queryKey: ["toil-entries"] });
      queryClient.invalidateQueries({ queryKey: ["toil-watch-balance"] });
      queryClient.invalidateQueries({ queryKey: ["cal-station"] });
      queryClient.invalidateQueries({ queryKey: ["cal-watch"] });
      queryClient.invalidateQueries({ queryKey: ["cal-personal"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast({
        title: "Shift adjustment deleted",
        description:
          "Calendar events removed and any TOIL hours have been refunded.",
      });
    },
    onError: (err: any) =>
      toast({
        title: "Failed to delete",
        description: err?.message ?? String(err),
        variant: "destructive",
      }),
  });

  const adjustments = (adjustmentsQ.data?.adjustments ?? []) as any[];
  // Newest first; filter to most recent + future by default to keep the
  // list short, with a "Show older" toggle if the WC needs to clean up
  // historical entries.
  const sorted = adjustments
    .slice()
    .sort(
      (a, b) =>
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    );

  // "Recent" cutoff: anything within the last 30 days or in the future.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const recent = sorted.filter(
    (a) => new Date(a.start_date) >= cutoff
  );
  const visible = showAll ? sorted : recent;
  const hasMore = !showAll && sorted.length > recent.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-brand" />
          <CardTitle className="text-sm font-medium">
            Shift Adjustments
          </CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">
          {sorted.length} total
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
          <p className="leading-snug">
            Deleting an adjustment removes its calendar events and refunds
            any TOIL hours that were spent on it. Use this to back out an
            erroneous entry — including legacy night-shift entries created
            before the Day/Night picker that show on two calendar dates.
          </p>
        </div>

        {adjustmentsQ.isLoading ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-4">
            No shift adjustments
            {!showAll && sorted.length > 0 ? " in the last 30 days" : ""}.
          </p>
        ) : (
          <ul className="space-y-2">
            {visible.map((a) => {
              const cfg = TYPE_STYLE[a.type] ?? TYPE_STYLE.flexi;
              const Icon = cfg.icon;
              const startStr = String(a.start_date).split("T")[0];
              const endStr = String(a.end_date).split("T")[0];
              const dateStr =
                startStr === endStr || a.shift_day_night === "Night"
                  ? fmtDate(startStr)
                  : `${fmtDate(startStr)} – ${fmtDate(endStr)}`;
              const isLegacy =
                (a.type === "h4h" || a.type === "toil" || a.type === "flexi") &&
                !a.shift_day_night;

              return (
                <li
                  key={a.id}
                  className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${cfg.border} ${cfg.bg}`}
                >
                  <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-semibold ${cfg.color} flex items-center gap-2 flex-wrap`}
                    >
                      {cfg.label}
                      {a.shift_day_night && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          {a.shift_day_night} Shift
                        </Badge>
                      )}
                      {a.toil_hours && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          {a.toil_hours}hrs
                        </Badge>
                      )}
                      {isLegacy && (
                        <Badge className="text-[9px] px-1 py-0 bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300">
                          Legacy — no Day/Night
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {dateStr}
                    </p>
                    {a.covering_name && (
                      <p className="text-xs text-muted-foreground/80 mt-0.5 truncate">
                        Covered by {a.covering_name}
                      </p>
                    )}
                    {a.covering_watch && (
                      <p className="text-xs text-muted-foreground/80 mt-0.5">
                        Covers {a.covering_watch} Watch
                      </p>
                    )}
                    {a.notes && (
                      <p className="text-xs text-muted-foreground/70 mt-1 italic">
                        {a.notes}
                      </p>
                    )}
                  </div>
                  {canManage && (
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Delete this ${cfg.label.toLowerCase()} entry? This will remove the calendar events and refund any TOIL hours. Cannot be undone.`
                          )
                        ) {
                          deleteMutation.mutate(a.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="shrink-0 h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      title="Delete adjustment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => setShowAll(true)}
          >
            Show older entries ({sorted.length - recent.length} more)
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
