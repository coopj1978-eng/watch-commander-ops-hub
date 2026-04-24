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
  TrendingUp,
  TrendingDown,
  Hourglass,
  Check,
  X,
  Loader2,
  ShieldCheck,
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
          {/* ── Balance summary tiles ─────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-2">
            <BalanceTile
              label="Earned"
              value={balance?.total_earned}
              icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
              tone="emerald"
              loading={balanceQ.isLoading}
            />
            <BalanceTile
              label="Used"
              value={balance?.total_spent}
              icon={<TrendingDown className="h-4 w-4 text-blue-500" />}
              tone="blue"
              loading={balanceQ.isLoading}
            />
            <BalanceTile
              label="Available"
              value={balance?.balance}
              icon={<Clock className="h-4 w-4 text-indigo-500" />}
              tone="indigo"
              loading={balanceQ.isLoading}
            />
          </div>
          {(balance?.pending_earned ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <Hourglass className="h-3.5 w-3.5" />
              {balance!.pending_earned}hrs pending approval
            </div>
          )}

          {/* ── Pending entries — WC/CC only get approve/reject buttons ── */}
          {entries.some((e) => e.status === "pending") && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Pending approval
              </p>
              {entries
                .filter((e) => e.status === "pending")
                .map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {e.hours}hrs · {e.reason || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Logged {format(parseISO(String(e.created_at)), "d MMM yyyy")}
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

          {/* ── Full ledger ───────────────────────────────────────────── */}
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
            ) : entries.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-4">
                No TOIL recorded this financial year.
              </p>
            ) : (
              <ul className="divide-y divide-border/50 border rounded-lg overflow-hidden">
                {entries.map((e) => (
                  <ToilEntryRow key={e.id} entry={e} />
                ))}
              </ul>
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
// Balance tile
// ─────────────────────────────────────────────────────────────────────────────
function BalanceTile({
  label,
  value,
  icon,
  tone,
  loading,
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  tone: "emerald" | "blue" | "indigo";
  loading: boolean;
}) {
  const toneCls =
    tone === "emerald"
      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
      : tone === "blue"
      ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
      : "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300";

  return (
    <div className={`rounded-xl border p-3 text-center ${toneCls}`}>
      <div className="flex justify-center mb-1">{icon}</div>
      {loading ? (
        <Skeleton className="h-6 w-12 mx-auto" />
      ) : (
        <p className="text-xl font-bold tabular-nums">{value ?? 0}</p>
      )}
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single ledger row
// ─────────────────────────────────────────────────────────────────────────────
function ToilEntryRow({ entry }: { entry: any }) {
  const isEarned = entry.type === "earned";
  const isPending = entry.status === "pending";
  const isRejected = entry.status === "rejected";

  return (
    <li className="flex items-center gap-3 px-3 py-2 text-xs">
      {isEarned ? (
        <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
      ) : (
        <TrendingDown className="h-3.5 w-3.5 text-blue-500 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{entry.reason || (isEarned ? "Hours earned" : "Shift off")}</p>
        <p className="text-muted-foreground text-[10px] flex items-center gap-1.5 flex-wrap mt-0.5">
          {entry.incident_date
            ? format(parseISO(String(entry.incident_date)), "d MMM yyyy")
            : format(parseISO(String(entry.created_at)), "d MMM yyyy")}
          {entry.job_number && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span>Job {entry.job_number}</span>
            </>
          )}
          {entry.approved_by_name && entry.status === "approved" && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="inline-flex items-center gap-0.5">
                <ShieldCheck className="h-2.5 w-2.5" />
                Approved by {entry.approved_by_name}
              </span>
            </>
          )}
        </p>
      </div>
      <span
        className={`font-mono tabular-nums shrink-0 ${
          isEarned ? "text-emerald-600 font-semibold" : "text-blue-600 font-semibold"
        }`}
      >
        {isEarned ? "+" : "−"}
        {entry.hours}hrs
      </span>
      {isPending && (
        <Badge variant="outline" className="text-[9px] px-1 py-0">
          pending
        </Badge>
      )}
      {isRejected && (
        <Badge variant="destructive" className="text-[9px] px-1 py-0">
          rejected
        </Badge>
      )}
    </li>
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

  const willAutoApprove = isManager;
  const willPromptApproval = isOwn && !isManager;

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
        description: willAutoApprove
          ? "Hours approved automatically."
          : "Submitted for approval.",
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

          {willPromptApproval && (
            <p className="text-[11px] text-muted-foreground">
              Your WC/CC will need to approve before these hours count.
            </p>
          )}
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
            ) : willAutoApprove ? (
              `Log & approve ${hours}hrs`
            ) : (
              `Submit ${hours}hrs`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
