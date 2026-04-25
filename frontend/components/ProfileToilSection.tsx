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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Clock,
  Plus,
  Hourglass,
  Check,
  X,
  Loader2,
  ShieldCheck,
  Pencil,
  Trash2,
  Save,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────────
// ProfileToilSection
//
// Renders inside the /people/:userId profile page (and /profile for "me").
// Visibility + edit are gated to: the profile owner OR any WC/CC.
//
// Header summary (earned / used / available / pending) wraps the existing
// /toil/balance endpoint; full ledger uses /toil. Both already accept a
// `user_id` filter so no backend changes are needed.
//
// "Add hours" button:
//   • Owner viewing their own profile → posts WITHOUT for_user_id (FF logs
//     go pending, WC/CC self-logs auto-approve — same as the dashboard
//     widget behaviour).
//   • WC/CC viewing someone else's profile → posts with for_user_id, which
//     the backend auto-approves because the caller is a manager.
//
// WC/CC also see inline approve / reject buttons on any pending entries
// for this user — keeps the approval flow available without bouncing the
// WC back to the dashboard widget.
// ──────────────────────────────────────────────────────────────────────────────

function currentFinancialYear(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

export interface ProfileToilSectionProps {
  /** The user_id whose profile is being shown — NOT necessarily the caller. */
  profileUserId: string;
  /** Display name — shown in the dialog as "Logging X hrs for Jane". */
  profileName?: string;
}

export function ProfileToilSection({
  profileUserId,
  profileName,
}: ProfileToilSectionProps) {
  const { user } = useAuth();
  const role = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fy = currentFinancialYear();

  const isOwn = user?.id === profileUserId;
  const isManager = role === "WC" || role === "CC";
  // The component itself shouldn't render if neither true — the parent
  // already guards on this, but belt-and-braces in case of misuse.
  const canView = isOwn || isManager;
  const canAdd = isOwn || isManager;

  const balanceQ = useQuery({
    queryKey: ["toil-balance", profileUserId, fy],
    queryFn: () =>
      backend.toil.balance({ user_id: profileUserId, financial_year: fy }),
    enabled: canView,
  });
  const balance = balanceQ.data?.balances?.[0];

  const entriesQ = useQuery({
    queryKey: ["toil-entries", profileUserId, fy],
    queryFn: () =>
      backend.toil.list({ user_id: profileUserId, financial_year: fy }),
    enabled: canView,
  });
  const entries = entriesQ.data?.entries ?? [];

  const [addOpen, setAddOpen] = useState(false);

  const approveMutation = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: number;
      action: "approved" | "rejected";
    }) => backend.toil.approve(id, { action }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["toil-balance"] });
      queryClient.invalidateQueries({ queryKey: ["toil-entries"] });
      queryClient.invalidateQueries({ queryKey: ["toil-pending"] });
      queryClient.invalidateQueries({ queryKey: ["toil-watch-balance"] });
      toast({
        title: vars.action === "approved" ? "TOIL approved" : "TOIL rejected",
      });
    },
    onError: (err: any) =>
      toast({
        title: "Failed",
        description: err?.message ?? String(err),
        variant: "destructive",
      }),
  });

  // Edit + delete invalidate the same caches as approve so balances + ledgers
  // refresh wherever they're shown (profile + dashboard widget).
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["toil-balance"] });
    queryClient.invalidateQueries({ queryKey: ["toil-entries"] });
    queryClient.invalidateQueries({ queryKey: ["toil-pending"] });
    queryClient.invalidateQueries({ queryKey: ["toil-watch-balance"] });
  };

  const updateMutation = useMutation({
    mutationFn: (vars: {
      id: number;
      hours?: number;
      reason?: string;
      job_number?: string | null;
      incident_date?: string | null;
    }) => (backend.toil as any).update(vars.id, {
      hours: vars.hours,
      reason: vars.reason,
      job_number: vars.job_number,
      incident_date: vars.incident_date,
    }),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "TOIL entry updated" });
    },
    onError: (err: any) =>
      toast({
        title: "Failed to update",
        description: err?.message ?? String(err),
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => (backend.toil as any).deleteEntry(id),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "TOIL entry deleted" });
    },
    onError: (err: any) =>
      toast({
        title: "Failed to delete",
        description: err?.message ?? String(err),
        variant: "destructive",
      }),
  });

  if (!canView) {
    // Guard for misuse — parent should already hide the tab. Render a
    // permission-denied placeholder rather than empty space.
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground text-sm">
          You don't have permission to view this section.
        </CardContent>
      </Card>
    );
  }

  // ── Build the running-balance ledger ───────────────────────────────────────
  // The "Available" headline = approved earned − spent. We compute a running
  // balance per row by walking the chronologically-ordered list of effective
  // transactions (approved earned + spent), then display newest-first with
  // each row's stored balance attached. Pending earned + rejected entries
  // don't affect the running total — pending sits in its own section above
  // the ledger; rejected rows are shown but flagged as not counted.
  const sortedAsc = [...entries].sort((a, b) => {
    const aDate = a.incident_date ? new Date(a.incident_date) : new Date(a.created_at);
    const bDate = b.incident_date ? new Date(b.incident_date) : new Date(b.created_at);
    if (aDate.getTime() !== bDate.getTime()) {
      return aDate.getTime() - bDate.getTime();
    }
    // Stable secondary sort by id so two same-day entries always show in
    // creation order.
    return a.id - b.id;
  });

  let running = 0;
  const balancesById = new Map<number, number>();
  for (const e of sortedAsc) {
    if (e.status === "approved" && e.type === "earned") {
      running += Number(e.hours);
    } else if (e.type === "spent") {
      // Spent entries don't have a "status" — they're recorded once the
      // shift adjustment commits — but treat any non-rejected spent row
      // as a real movement. We sum all of them.
      running -= Number(e.hours);
    }
    balancesById.set(e.id, running);
  }

  const ledgerRows = [...entries].sort((a, b) => {
    const aDate = a.incident_date ? new Date(a.incident_date) : new Date(a.created_at);
    const bDate = b.incident_date ? new Date(b.incident_date) : new Date(b.created_at);
    if (aDate.getTime() !== bDate.getTime()) {
      return bDate.getTime() - aDate.getTime();
    }
    return b.id - a.id;
  });

  const pendingEntries = entries.filter((e) => e.status === "pending");

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-500" />
            <CardTitle className="text-sm font-medium">
              TOIL — FY {fy}/{String(fy + 1).slice(2)}
            </CardTitle>
          </div>
          {canAdd && (
            <Button
              size="sm"
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add hours
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ── Available headline ────────────────────────────────────────
                Single big number — that's the only figure people use day-
                to-day. "Earned" and "Used" are visible inline in the
                ledger via the running balance column, so a separate tile
                just duplicates the data. */}
          <div className="rounded-xl border bg-muted/30 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Available
                </p>
                {balanceQ.isLoading ? (
                  <Skeleton className="h-7 w-20 mt-0.5" />
                ) : (
                  <p className="text-2xl font-bold tabular-nums leading-tight">
                    {balance?.balance ?? 0}
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      hrs
                    </span>
                  </p>
                )}
              </div>
            </div>
            {(balance?.pending_earned ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 text-right">
                <Hourglass className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold">{balance!.pending_earned}hrs</span>
                  <br />
                  pending approval
                </span>
              </div>
            )}
          </div>

          {/* ── Pending entries — any WC/CC can approve / reject, including
                entries they themselves logged. The created_by + approved_by
                columns plus the activity log preserve the audit trail. */}
          {pendingEntries.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Pending approval ({pendingEntries.length})
              </p>
              {pendingEntries.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {e.hours}hrs · {e.reason || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e.incident_date
                        ? `Incident ${format(parseISO(String(e.incident_date)), "d MMM yyyy")}`
                        : `Logged ${format(parseISO(String(e.created_at)), "d MMM yyyy")}`}
                      {e.job_number ? ` · Job ${e.job_number}` : ""}
                    </p>
                  </div>
                  {isManager && (
                    <>
                      <button
                        onClick={() =>
                          approveMutation.mutate({
                            id: e.id,
                            action: "approved",
                          })
                        }
                        disabled={approveMutation.isPending}
                        className="shrink-0 h-7 w-7 rounded-md flex items-center justify-center bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400"
                        title="Approve"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          approveMutation.mutate({
                            id: e.id,
                            action: "rejected",
                          })
                        }
                        disabled={approveMutation.isPending}
                        className="shrink-0 h-7 w-7 rounded-md flex items-center justify-center bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-400"
                        title="Reject"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Running-total ledger ──────────────────────────────────────
                Bank-statement style. Each row shows when, what, hours,
                job #, who authorised it, when, and the running balance
                after that movement. Approved earned and spent rows
                contribute to the running total; rejected and pending
                rows are listed but marked. */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Ledger
            </p>
            {entriesQ.isLoading ? (
              <div className="space-y-1.5">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-7 w-full" />
                ))}
              </div>
            ) : ledgerRows.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-4">
                No TOIL recorded this financial year.
              </p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50 text-[10px] uppercase tracking-widest text-muted-foreground">
                        <th className="text-left font-semibold px-3 py-2">Date</th>
                        <th className="text-left font-semibold px-3 py-2">Reason</th>
                        <th className="text-right font-semibold px-3 py-2">Hours</th>
                        <th className="text-left font-semibold px-3 py-2">Job #</th>
                        <th className="text-left font-semibold px-3 py-2">Authorised by</th>
                        <th className="text-left font-semibold px-3 py-2">Auth date</th>
                        <th className="text-right font-semibold px-3 py-2">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {ledgerRows.map((e) => {
                        const iLoggedThis = e.created_by === user?.id;
                        const canManage =
                          iLoggedThis ||
                          isManager; // WC + CC can manage on their watch
                        return (
                          <LedgerRow
                            key={e.id}
                            entry={e}
                            balanceAfter={balancesById.get(e.id)}
                            canManage={canManage}
                            onUpdate={(payload) =>
                              updateMutation.mutate({ id: e.id, ...payload })
                            }
                            onDelete={() => {
                              if (
                                confirm(
                                  `Delete this ${e.type} entry of ${e.hours}hrs? This cannot be undone.`
                                )
                              ) {
                                deleteMutation.mutate(e.id);
                              }
                            }}
                            saving={updateMutation.isPending || deleteMutation.isPending}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AddHoursDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        profileUserId={profileUserId}
        profileName={profileName}
        isOwn={isOwn}
        isManager={isManager}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LedgerRow — bank-statement-style row with running balance.
//
// Earned/Approved → green +Xhrs, contributes to balance
// Earned/Pending  → muted +Xhrs with "pending" badge, doesn't contribute
// Earned/Rejected → strikethrough +Xhrs with "rejected" badge
// Spent           → red −Xhrs, contributes to balance
//
// When `canManage` is true the row exposes inline edit (hours / reason /
// job # / date) and delete buttons. Edit opens an in-row form; delete
// confirms then removes. Both invalidate the parent's TOIL caches so the
// table + balance refresh together.
// ─────────────────────────────────────────────────────────────────────────────
function LedgerRow({
  entry,
  balanceAfter,
  canManage,
  onUpdate,
  onDelete,
  saving,
}: {
  entry: any;
  balanceAfter: number | undefined;
  canManage: boolean;
  onUpdate: (payload: {
    hours?: number;
    reason?: string;
    job_number?: string | null;
    incident_date?: string | null;
  }) => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editHours, setEditHours] = useState<string>(String(entry.hours));
  const [editReason, setEditReason] = useState<string>(entry.reason ?? "");
  const [editJob, setEditJob] = useState<string>(entry.job_number ?? "");
  const [editDate, setEditDate] = useState<string>(
    entry.incident_date
      ? String(entry.incident_date).split("T")[0]
      : String(entry.created_at).split("T")[0]
  );

  const isEarned = entry.type === "earned";
  const isPending = entry.status === "pending";
  const isRejected = entry.status === "rejected";
  const counts = (isEarned && entry.status === "approved") || entry.type === "spent";

  const dateStr = entry.incident_date
    ? format(parseISO(String(entry.incident_date)), "d MMM yyyy")
    : format(parseISO(String(entry.created_at)), "d MMM yyyy");

  const authDateStr =
    entry.status === "approved" && entry.approved_at
      ? format(parseISO(String(entry.approved_at)), "d MMM yyyy")
      : "—";

  const startEdit = () => {
    setEditHours(String(entry.hours));
    setEditReason(entry.reason ?? "");
    setEditJob(entry.job_number ?? "");
    setEditDate(
      entry.incident_date
        ? String(entry.incident_date).split("T")[0]
        : String(entry.created_at).split("T")[0]
    );
    setEditing(true);
  };

  const saveEdit = () => {
    const hoursNum = Number(editHours);
    if (!Number.isFinite(hoursNum) || hoursNum <= 0) return;
    onUpdate({
      hours: hoursNum,
      reason: editReason.trim() || undefined,
      job_number: editJob.trim() || null,
      incident_date: editDate || null,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <tr className="bg-amber-50/40 dark:bg-amber-950/20">
        <td className="px-3 py-2 align-top whitespace-nowrap">
          <input
            type="date"
            value={editDate}
            onChange={(e) => setEditDate(e.target.value)}
            className="h-7 w-32 rounded border border-border px-2 text-xs bg-background"
          />
        </td>
        <td className="px-3 py-2 align-top">
          <input
            type="text"
            value={editReason}
            onChange={(e) => setEditReason(e.target.value)}
            placeholder="Reason"
            className="h-7 w-full rounded border border-border px-2 text-xs bg-background"
          />
        </td>
        <td className="px-3 py-2 align-top text-right whitespace-nowrap">
          <input
            type="number"
            min="0.5"
            step="0.5"
            value={editHours}
            onChange={(e) => setEditHours(e.target.value)}
            className="h-7 w-16 rounded border border-border px-2 text-xs bg-background text-right font-mono tabular-nums"
          />
        </td>
        <td className="px-3 py-2 align-top">
          <input
            type="text"
            value={editJob}
            onChange={(e) => setEditJob(e.target.value)}
            placeholder="Job #"
            className="h-7 w-28 rounded border border-border px-2 text-xs bg-background font-mono"
          />
        </td>
        <td colSpan={2} className="px-3 py-2 align-top text-muted-foreground text-[10px]">
          Editing — approver / auth date unchanged
        </td>
        <td className="px-3 py-2 align-top whitespace-nowrap text-right">
          <div className="inline-flex gap-1">
            <button
              onClick={() => setEditing(false)}
              className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted"
              title="Cancel"
              disabled={saving}
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={saveEdit}
              className="h-6 w-6 rounded flex items-center justify-center bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400"
              title="Save"
              disabled={saving}
            >
              <Save className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-muted/30 transition-colors group">
      <td className="px-3 py-2 align-top whitespace-nowrap font-mono tabular-nums text-muted-foreground">
        {dateStr}
      </td>
      <td className="px-3 py-2 align-top">
        <span className={isRejected ? "line-through text-muted-foreground" : ""}>
          {entry.reason || (isEarned ? "Hours earned" : "Shift off (TOIL spent)")}
        </span>
        {(isPending || isRejected) && (
          <Badge
            variant={isRejected ? "destructive" : "outline"}
            className="ml-2 text-[9px] px-1 py-0 align-middle"
          >
            {isPending ? "pending" : "rejected"}
          </Badge>
        )}
      </td>
      <td
        className={`px-3 py-2 align-top text-right font-mono tabular-nums whitespace-nowrap ${
          isRejected
            ? "line-through text-muted-foreground"
            : isEarned
            ? "text-emerald-600 dark:text-emerald-400 font-semibold"
            : "text-red-600 dark:text-red-400 font-semibold"
        }`}
      >
        {isEarned ? "+" : "−"}
        {entry.hours}
      </td>
      <td className="px-3 py-2 align-top text-muted-foreground whitespace-nowrap">
        {entry.job_number || "—"}
      </td>
      <td className="px-3 py-2 align-top text-muted-foreground whitespace-nowrap">
        {entry.approved_by_name ? (
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            {entry.approved_by_name}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2 align-top text-muted-foreground whitespace-nowrap font-mono tabular-nums">
        {authDateStr}
      </td>
      <td className="px-3 py-2 align-top text-right whitespace-nowrap font-mono tabular-nums">
        <div className="inline-flex items-center gap-2">
          {counts ? (
            <span className="font-semibold">{balanceAfter ?? 0}</span>
          ) : (
            <span className="text-muted-foreground/50">—</span>
          )}
          {canManage && (
            <span className="inline-flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={startEdit}
                disabled={saving}
                className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Edit"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={onDelete}
                disabled={saving}
                className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Hours dialog
// ─────────────────────────────────────────────────────────────────────────────
function AddHoursDialog({
  open,
  onOpenChange,
  profileUserId,
  profileName,
  isOwn,
  isManager,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileUserId: string;
  profileName?: string;
  isOwn: boolean;
  isManager: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [hours, setHours] = useState("1");
  const [reason, setReason] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [incidentDate, setIncidentDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const mutation = useMutation({
    mutationFn: () =>
      backend.toil.earn({
        hours: Number(hours),
        reason: reason.trim(),
        job_number: jobNumber.trim() || undefined,
        incident_date: `${incidentDate}T00:00:00.000Z`,
        // Only set for_user_id when logging for someone else. WC/CC
        // logging on their OWN profile leaves this undefined; the
        // backend handles it identically.
        for_user_id: !isOwn ? profileUserId : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["toil-balance"] });
      queryClient.invalidateQueries({ queryKey: ["toil-entries"] });
      queryClient.invalidateQueries({ queryKey: ["toil-pending"] });
      queryClient.invalidateQueries({ queryKey: ["toil-watch-balance"] });
      toast({
        title: "TOIL logged",
        description:
          "Submitted for approval — a WC or CC will be notified.",
      });
      // Reset and close
      setHours("1");
      setReason("");
      setJobNumber("");
      setIncidentDate(new Date().toISOString().split("T")[0]);
      onOpenChange(false);
    },
    onError: (err: any) =>
      toast({
        title: "Failed to log TOIL",
        description: err?.message ?? String(err),
        variant: "destructive",
      }),
  });

  const valid =
    Number(hours) > 0 && reason.trim().length > 0 && incidentDate.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-emerald-500" />
            Log TOIL hours
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {profileName && !isOwn && (
            <p className="text-xs text-muted-foreground">
              Logging hours for{" "}
              <span className="font-semibold text-foreground">{profileName}</span>.
            </p>
          )}

          <div>
            <Label htmlFor="toil-hours" className="text-xs">
              Hours worked
            </Label>
            <Input
              id="toil-hours"
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="mt-1 h-8 text-sm"
            />
          </div>

          <div>
            <Label htmlFor="toil-date" className="text-xs">
              Incident date
            </Label>
            <Input
              id="toil-date"
              type="date"
              value={incidentDate}
              onChange={(e) => setIncidentDate(e.target.value)}
              className="mt-1 h-8 text-sm"
            />
          </div>

          <div>
            <Label htmlFor="toil-job" className="text-xs">
              Job number{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="toil-job"
              placeholder="e.g. INC-2026-04821"
              value={jobNumber}
              onChange={(e) => setJobNumber(e.target.value)}
              className="mt-1 h-8 text-sm"
            />
          </div>

          <div>
            <Label htmlFor="toil-reason" className="text-xs">
              Reason
            </Label>
            <Input
              id="toil-reason"
              placeholder="e.g. Held up at incident — Maryhill Rd fire"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 h-8 text-sm"
            />
          </div>

          <p className="text-[11px] text-muted-foreground">
            All TOIL entries are submitted as pending and require sign-off
            by a WC or CC. Audit trail records who logged it and who
            approved it.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={!valid || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                Logging…
              </>
            ) : (
              `Submit ${hours}hrs for approval`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
