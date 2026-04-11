import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, ArrowLeftRight, GraduationCap, Plus, X, Pencil, RefreshCw, Sun } from "lucide-react";
import ShiftAdjustmentModal from "@/components/ShiftAdjustmentModal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";

const TYPE_STYLE = {
  flexi:         { label: "Flexi Day",     icon: CalendarDays,   color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-950/40",   border: "border-amber-300 dark:border-amber-700"  },
  training:      { label: "Training",      icon: GraduationCap,  color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/40",    border: "border-blue-300 dark:border-blue-700"   },
  h4h:           { label: "Head for Head", icon: ArrowLeftRight, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/40",  border: "border-purple-300 dark:border-purple-700" },
  flexi_payback: { label: "Flexi Payback", icon: RefreshCw,      color: "text-teal-600 dark:text-teal-400",   bg: "bg-teal-50 dark:bg-teal-950/40",    border: "border-teal-300 dark:border-teal-700"   },
  orange_day:    { label: "Orange Day",    icon: Sun,            color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/40",  border: "border-orange-300 dark:border-orange-700" },
} as const;

const fmt = (d: string) =>
  new Date(String(d).split("T")[0] + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

export default function FFShiftAdjustmentWidget() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["shift-adjustments-mine", user?.id],
    queryFn: () =>
      backend.shift_adjustments.list({
        user_id: user!.id,
        start_date: new Date().toISOString().split("T")[0],
      }),
    enabled: !!user?.id,
  });

  const adjustments = data?.adjustments ?? [];
  const upcoming = adjustments.slice(0, 5);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => backend.shift_adjustments.deleteAdjustment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift-adjustments-mine"] });
      queryClient.invalidateQueries({ queryKey: ["shift-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["cal-station"] });
      queryClient.invalidateQueries({ queryKey: ["cal-watch"] });
      queryClient.invalidateQueries({ queryKey: ["cal-personal"] });
      toast({ title: "Shift adjustment removed" });
    },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  return (
    <>
      <Card className="border-t-2 border-t-indigo-500">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-indigo-500" />
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Shift Adjustments
            </CardTitle>
          </div>
          <Button
            size="sm"
            onClick={() => setModalOpen(true)}
            className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Log
          </Button>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-3">Loading…</p>
          ) : upcoming.length === 0 ? (
            <div className="text-center py-5 text-muted-foreground">
              <CalendarDays className="h-7 w-7 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No upcoming shift adjustments</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Use the button above to log a Flexi, Training, H4H, Flexi Payback, or Orange Day</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map(a => {
                const cfg = TYPE_STYLE[a.type];
                const Icon = cfg.icon;
                const startStr = String(a.start_date).split("T")[0];
                const endStr   = String(a.end_date).split("T")[0];
                const dateStr  = startStr === endStr ? fmt(startStr) : `${fmt(startStr)} – ${fmt(endStr)}`;
                return (
                  <div key={a.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${cfg.border} ${cfg.bg}`}>
                    <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{dateStr}</p>
                      {a.covering_watch && (
                        <p className="text-xs text-muted-foreground/70 truncate">{a.covering_watch} Watch · {a.shift_day_night ?? "Day"} Shift</p>
                      )}
                      {!a.covering_watch && a.covering_name && (
                        <p className="text-xs text-muted-foreground/70 truncate">Cover: {a.covering_name}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setModalOpen(true)}
                      className="shrink-0 text-muted-foreground hover:text-indigo-500"
                      title="Edit"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(a.id)}
                      disabled={deleteMutation.isPending}
                      className="shrink-0 text-muted-foreground hover:text-red-500"
                      title="Delete"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ShiftAdjustmentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
