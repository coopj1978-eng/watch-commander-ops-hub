import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import backend from "@/lib/backend";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { useUserRole } from "@/lib/rbac";
import { Heart, Pencil, Trash2 } from "lucide-react";
import type { AbsenceType } from "~backend/absence/types";

// ──────────────────────────────────────────────────────────────────────────────
// AbsenceHistorySection
//
// Drop-in replacement for the inline Absence History card on the profile
// page. Adds three things the original was missing:
//
//   1. Rolling 6-month totals computed live from the absences themselves,
//      so it never disagrees with what's visible in the table. The
//      profile's `rolling_sick_episodes` / `rolling_sick_days` fields are
//      maintained by a nightly rollup and are stale until that runs —
//      hence the "0 episodes, 0 days" the user was seeing while the
//      table clearly listed four sickness episodes.
//
//   2. Per-row Edit / Mark fit / Delete actions for WC/CC. Edit reuses
//      the existing PATCH /absences/:id/update endpoint (date corrections).
//      Mark fit closes an open sickness via the new
//      POST /absences/:id/book-back-fit endpoint. Delete is irreversible
//      and gated to WC/CC only.
//
//   3. Visible "Open" pill on any sickness whose `returned_to_work_at`
//      is still NULL — gives the WC an obvious cue for which row needs
//      a back-fit action.
// ──────────────────────────────────────────────────────────────────────────────

const absenceTypeLabels: Record<AbsenceType, string> = {
  sickness: "Sickness",
  AL: "Annual Leave",
  TOIL: "TOIL",
  parental: "Parental",
  other: "Other",
};

const statusBadgeClass: Record<string, string> = {
  approved: "bg-green-100 text-green-700 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900",
  pending:  "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  rejected: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
};

/** Inclusive day-count between two YYYY-MM-DD-ish dates. */
function inclusiveDays(start: string | Date, end: string | Date): number {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Today as YYYY-MM-DD (for the date-picker max attribute). */
function todayLocalIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Coerce an Absence date field to YYYY-MM-DD for date-picker binding. */
function toIsoDate(v: string | Date | null | undefined): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function AbsenceHistorySection({ userId }: { userId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const role = useUserRole();
  const canManage = role === "WC" || role === "CC";

  const { data, isLoading } = useQuery({
    queryKey: ["absences", userId],
    queryFn: async () => backend.absence.list({ user_id: userId, limit: 200 }),
    enabled: !!userId,
  });

  const absences = data?.absences ?? [];

  // Rolling 6-month totals — computed live so they always match the
  // table on screen. We count only sickness, only approved, and only
  // episodes that intersect the last six months. An episode that
  // started 7 months ago but extended into the window still counts;
  // days are only the portion inside the window.
  const totals = useMemo(() => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const today = new Date();
    let episodes = 0;
    let days = 0;
    for (const a of absences) {
      if (a.type !== "sickness" || a.status !== "approved") continue;
      const start = new Date(a.start_date);
      // For open sicknesses (no return-to-work yet), use today as the
      // effective end so the running total reflects what the WC is
      // actually managing right now.
      const end = a.returned_to_work_at
        ? new Date(a.returned_to_work_at)
        : new Date(a.end_date) > today
        ? today
        : new Date(a.end_date);
      if (end < sixMonthsAgo) continue;
      episodes += 1;
      const windowStart = start < sixMonthsAgo ? sixMonthsAgo : start;
      const windowEnd = end > today ? today : end;
      days += inclusiveDays(windowStart, windowEnd);
    }
    return { episodes, days };
  }, [absences]);

  // ── Edit dialog state ─────────────────────────────────────────────────────
  const [editing, setEditing] = useState<null | {
    id: number;
    start_date: string;
    end_date: string;
    reason: string;
  }>(null);

  const updateMutation = useMutation({
    mutationFn: async (vars: { id: number; start_date: string; end_date: string }) => {
      // Send ISO datetimes — Encore expects Date-typed fields.
      return backend.absence.updateAbsence(vars.id, {
        start_date: new Date(vars.start_date + "T00:00:00.000Z").toISOString(),
        end_date: new Date(vars.end_date + "T00:00:00.000Z").toISOString(),
      });
    },
    onSuccess: () => {
      toast({ title: "Absence updated" });
      queryClient.invalidateQueries({ queryKey: ["absences", userId] });
      queryClient.invalidateQueries({ queryKey: ["wc-absences-today"] });
      queryClient.invalidateQueries({ queryKey: ["absences-today-sick"] });
      setEditing(null);
    },
    onError: (err: any) => {
      toast({
        title: "Could not update absence",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => backend.absence.deleteAbsence(id),
    onSuccess: () => {
      toast({ title: "Absence deleted" });
      queryClient.invalidateQueries({ queryKey: ["absences", userId] });
      queryClient.invalidateQueries({ queryKey: ["wc-absences-today"] });
      queryClient.invalidateQueries({ queryKey: ["absences-today-sick"] });
    },
    onError: (err: any) => {
      toast({
        title: "Could not delete absence",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const bookFitMutation = useMutation({
    mutationFn: async (id: number) => backend.absence.bookBackFit({ absence_id: id }),
    onSuccess: () => {
      toast({ title: "Booked back fit" });
      queryClient.invalidateQueries({ queryKey: ["absences", userId] });
      queryClient.invalidateQueries({ queryKey: ["wc-absences-today"] });
      queryClient.invalidateQueries({ queryKey: ["absences-today-sick"] });
    },
    onError: (err: any) => {
      toast({
        title: "Could not book back fit",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const today = todayLocalIso();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Absence History</CardTitle>
            <CardDescription>
              Rolling 6-month totals: <strong>{totals.episodes} episode{totals.episodes === 1 ? "" : "s"}</strong>,{" "}
              <strong>{totals.days} day{totals.days === 1 ? "" : "s"}</strong>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 7 : 6} className="text-center py-8">
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ) : absences.length > 0 ? (
                absences.map((absence) => {
                  const days = inclusiveDays(absence.start_date, absence.end_date);
                  const isOpenSickness =
                    absence.type === "sickness" &&
                    absence.status === "approved" &&
                    !absence.returned_to_work_at;
                  return (
                    <TableRow key={absence.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{absenceTypeLabels[absence.type]}</Badge>
                          {isOpenSickness && (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900">
                              Open
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{new Date(absence.start_date).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(absence.end_date).toLocaleDateString()}</TableCell>
                      <TableCell>{days}</TableCell>
                      <TableCell className="max-w-xs truncate">{absence.reason}</TableCell>
                      <TableCell>
                        <Badge className={statusBadgeClass[absence.status] ?? ""}>
                          {absence.status}
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isOpenSickness && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-green-700 hover:text-green-800 hover:bg-green-50 dark:hover:bg-green-950/20"
                                disabled={bookFitMutation.isPending}
                                onClick={() => bookFitMutation.mutate(absence.id)}
                                title="Book this firefighter back fit and close the sickness"
                              >
                                <Heart className="h-3 w-3 mr-1" />
                                Mark fit
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() =>
                                setEditing({
                                  id: absence.id,
                                  start_date: toIsoDate(absence.start_date),
                                  end_date: toIsoDate(absence.end_date),
                                  reason: absence.reason ?? "",
                                })
                              }
                              title="Edit dates"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                              disabled={deleteMutation.isPending}
                              onClick={() => {
                                if (
                                  confirm(
                                    `Delete this ${absenceTypeLabels[absence.type]} record? This cannot be undone.`
                                  )
                                ) {
                                  deleteMutation.mutate(absence.id);
                                }
                              }}
                              title="Delete this absence record"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={canManage ? 7 : 6} className="text-center py-8 text-muted-foreground">
                    No absences recorded
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Edit dialog — date-only edit. The reason field is left untouched
          because the existing updateAbsence endpoint doesn't accept it,
          and date corrections cover the actual "I logged the wrong day"
          case. If notes need amending, the WC can delete + re-create. */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit absence dates</DialogTitle>
            <DialogDescription>
              Adjust the start or end date if the record was logged incorrectly.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit-absence-start">First day off</Label>
                  <Input
                    id="edit-absence-start"
                    type="date"
                    max={today}
                    value={editing.start_date}
                    onChange={(e) =>
                      setEditing((prev) => prev && { ...prev, start_date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-absence-end">Last day off</Label>
                  <Input
                    id="edit-absence-end"
                    type="date"
                    min={editing.start_date}
                    max={today}
                    value={editing.end_date}
                    onChange={(e) =>
                      setEditing((prev) => prev && { ...prev, end_date: e.target.value })
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                <strong>{inclusiveDays(editing.start_date, editing.end_date)}</strong>{" "}
                day{inclusiveDays(editing.start_date, editing.end_date) === 1 ? "" : "s"} off
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              disabled={
                !editing ||
                !editing.start_date ||
                !editing.end_date ||
                editing.end_date < editing.start_date ||
                updateMutation.isPending
              }
              onClick={() =>
                editing &&
                updateMutation.mutate({
                  id: editing.id,
                  start_date: editing.start_date,
                  end_date: editing.end_date,
                })
              }
            >
              {updateMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
