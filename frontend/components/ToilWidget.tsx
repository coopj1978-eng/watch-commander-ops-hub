import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/App";
import { useUserRole } from "@/lib/rbac";
import backend from "@/lib/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Clock, Plus, Check, X, Loader2, TrendingUp, TrendingDown, Hourglass,
} from "lucide-react";

const WATCHES = ["Red", "White", "Green", "Blue", "Amber"] as const;

function currentFinancialYear(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

export default function ToilWidget() {
  const { user } = useAuth();
  const userRole = useUserRole();
  const isManager = ["WC", "CC"].includes(userRole);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fy = currentFinancialYear();

  const [earnOpen, setEarnOpen] = useState(false);
  const [earnHours, setEarnHours] = useState("1");
  const [earnReason, setEarnReason] = useState("");
  const [earnDate, setEarnDate] = useState(new Date().toISOString().split("T")[0]);
  const [earnForAnother, setEarnForAnother] = useState(false);
  const [earnForWatch, setEarnForWatch] = useState("");
  const [earnForUserId, setEarnForUserId] = useState("");

  // Balance query
  const { data: balanceData } = useQuery({
    queryKey: ["toil-balance", user?.id, fy],
    queryFn: () => backend.toil.balance({ user_id: user!.id, financial_year: fy }),
    enabled: !!user?.id,
  });
  const myBalance = balanceData?.balances?.[0];

  // Recent entries
  const { data: entriesData } = useQuery({
    queryKey: ["toil-entries", user?.id, fy],
    queryFn: () => backend.toil.list({ user_id: user!.id, financial_year: fy }),
    enabled: !!user?.id,
  });
  const entries = entriesData?.entries ?? [];
  const recentEntries = entries.slice(0, 5);

  // Pending approvals (WC/CC only — for the whole watch)
  const { data: pendingData } = useQuery({
    queryKey: ["toil-pending", user?.watch_unit, fy],
    queryFn: () => backend.toil.list({ watch_unit: user!.watch_unit!, status: "pending", financial_year: fy }),
    enabled: !!user?.watch_unit && isManager,
  });
  const pending = pendingData?.entries ?? [];

  // Watch balances (WC/CC only)
  const { data: watchBalanceData } = useQuery({
    queryKey: ["toil-watch-balance", user?.watch_unit, fy],
    queryFn: () => backend.toil.balance({ watch_unit: user!.watch_unit!, financial_year: fy }),
    enabled: !!user?.watch_unit && isManager,
  });
  const watchBalances = watchBalanceData?.balances ?? [];

  // Roster for "log for another"
  const { data: forRosterData } = useQuery({
    queryKey: ["crewing-roster", earnForWatch],
    queryFn: () => backend.crewing.roster({ watch: earnForWatch }),
    enabled: earnForAnother && !!earnForWatch,
  });
  const forRoster = forRosterData?.members ?? [];

  const earnMutation = useMutation({
    mutationFn: () => backend.toil.earn({
      hours: Number(earnHours),
      reason: earnReason.trim(),
      incident_date: `${earnDate}T00:00:00.000Z`,
      for_user_id: earnForAnother && earnForUserId ? earnForUserId : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["toil-balance"] });
      queryClient.invalidateQueries({ queryKey: ["toil-entries"] });
      queryClient.invalidateQueries({ queryKey: ["toil-pending"] });
      queryClient.invalidateQueries({ queryKey: ["toil-watch-balance"] });
      toast({ title: "TOIL logged", description: isManager ? "Hours approved automatically." : "Submitted for approval." });
      setEarnOpen(false);
      setEarnHours("1");
      setEarnReason("");
      setEarnForAnother(false);
      setEarnForWatch("");
      setEarnForUserId("");
    },
    onError: (err: any) => toast({ title: "Failed", description: err?.message ?? String(err), variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "approved" | "rejected" }) =>
      backend.toil.approve(id, { id, action }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["toil-balance"] });
      queryClient.invalidateQueries({ queryKey: ["toil-entries"] });
      queryClient.invalidateQueries({ queryKey: ["toil-pending"] });
      queryClient.invalidateQueries({ queryKey: ["toil-watch-balance"] });
      toast({ title: vars.action === "approved" ? "TOIL approved" : "TOIL rejected" });
    },
    onError: (err: any) => toast({ title: "Failed", description: err?.message ?? String(err), variant: "destructive" }),
  });

  const fmt = (d: string) =>
    new Date(String(d).split("T")[0] + "T12:00:00").toLocaleDateString("en-GB", {
      day: "numeric", month: "short",
    });

  return (
    <>
      <Card className="border-t-2 border-t-emerald-500">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-emerald-500" />
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              TOIL
            </CardTitle>
          </div>
          <Button
            size="sm"
            onClick={() => setEarnOpen(true)}
            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Log Hours
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Balance summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-2.5 text-center">
              <TrendingUp className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                {myBalance?.total_earned ?? 0}
              </p>
              <p className="text-[10px] text-muted-foreground">Earned</p>
            </div>
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-2.5 text-center">
              <TrendingDown className="h-4 w-4 mx-auto text-blue-500 mb-1" />
              <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                {myBalance?.total_spent ?? 0}
              </p>
              <p className="text-[10px] text-muted-foreground">Used</p>
            </div>
            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 p-2.5 text-center">
              <Clock className="h-4 w-4 mx-auto text-indigo-500 mb-1" />
              <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
                {myBalance?.balance ?? 0}
              </p>
              <p className="text-[10px] text-muted-foreground">Available</p>
            </div>
          </div>
          {(myBalance?.pending_earned ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <Hourglass className="h-3.5 w-3.5" />
              {myBalance!.pending_earned}hrs pending approval
            </div>
          )}

          {/* Pending approvals (WC/CC only) */}
          {isManager && pending.length > 0 && (
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
                Awaiting Your Approval ({pending.length})
              </p>
              {pending.map(e => (
                <div key={e.id} className="flex items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{e.user_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {e.hours}hrs · {e.incident_date ? fmt(String(e.incident_date)) : "—"} · {e.reason}
                    </p>
                  </div>
                  <button
                    onClick={() => approveMutation.mutate({ id: e.id, action: "approved" })}
                    disabled={approveMutation.isPending}
                    className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400"
                    title="Approve"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => approveMutation.mutate({ id: e.id, action: "rejected" })}
                    disabled={approveMutation.isPending}
                    className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center bg-red-100 text-red-500 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-400"
                    title="Reject"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Watch balances (WC/CC only) */}
          {isManager && watchBalances.length > 0 && (
            <div className="border-t border-border pt-3 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Watch TOIL Balances
              </p>
              {watchBalances.map(b => (
                <div key={b.user_id} className="flex items-center justify-between text-xs px-1">
                  <span className="text-foreground">{b.user_name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-600">{b.total_earned}hrs earned</span>
                    <span className="text-blue-600">{b.total_spent}hrs used</span>
                    <Badge variant={b.balance > 0 ? "default" : "secondary"} className="text-[10px]">
                      {b.balance}hrs
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent history */}
          {recentEntries.length > 0 && (
            <div className="border-t border-border pt-3 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Recent
              </p>
              {recentEntries.map(e => (
                <div key={e.id} className="flex items-center justify-between text-xs px-1 py-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {e.type === "earned" ? (
                      <TrendingUp className="h-3 w-3 text-emerald-500 shrink-0" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-blue-500 shrink-0" />
                    )}
                    <span className="text-muted-foreground truncate">{e.reason || (e.type === "spent" ? "Shift off" : "Hours earned")}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={e.type === "earned" ? "text-emerald-600 font-semibold" : "text-blue-600 font-semibold"}>
                      {e.type === "earned" ? "+" : "-"}{e.hours}hrs
                    </span>
                    {e.status === "pending" && <Badge variant="outline" className="text-[9px] px-1 py-0">pending</Badge>}
                    {e.status === "rejected" && <Badge variant="destructive" className="text-[9px] px-1 py-0">rejected</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!myBalance && recentEntries.length === 0 && (
            <div className="text-center py-3 text-muted-foreground">
              <Clock className="h-7 w-7 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No TOIL recorded this year</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Log hours earned from overtime or incident holdovers</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Earn TOIL dialog ── */}
      <Dialog open={earnOpen} onOpenChange={o => { if (!o) setEarnOpen(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-emerald-500" /> Log TOIL Hours
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Hours worked</Label>
              <Input
                type="number"
                min="0.5"
                max="24"
                step="0.5"
                value={earnHours}
                onChange={e => setEarnHours(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Date</Label>
              <Input
                type="date"
                value={earnDate}
                onChange={e => setEarnDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Reason</Label>
              <Input
                placeholder="e.g. Held up at incident — Maryhill Rd fire"
                value={earnReason}
                onChange={e => setEarnReason(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            {/* Log for another (WC/CC) */}
            {isManager && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={earnForAnother}
                    onChange={e => { setEarnForAnother(e.target.checked); setEarnForWatch(""); setEarnForUserId(""); }}
                    className="h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-medium text-muted-foreground">Log for another user</span>
                </label>

                {earnForAnother && (
                  <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
                    <Select value={earnForWatch} onValueChange={v => { setEarnForWatch(v); setEarnForUserId(""); }}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select watch…" />
                      </SelectTrigger>
                      <SelectContent>
                        {WATCHES.map(w => <SelectItem key={w} value={w}>{w} Watch</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {earnForWatch && (
                      <Select value={earnForUserId} onValueChange={setEarnForUserId}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select person…" />
                        </SelectTrigger>
                        <SelectContent>
                          {forRoster.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </div>
            )}

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              disabled={!earnReason.trim() || !earnHours || Number(earnHours) <= 0 || earnMutation.isPending || (earnForAnother && !earnForUserId)}
              onClick={() => earnMutation.mutate()}
            >
              {earnMutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Logging…</>
                : isManager
                ? `Log & Approve ${earnHours}hrs`
                : `Submit ${earnHours}hrs for Approval`
              }
            </Button>
            {!isManager && (
              <p className="text-[11px] text-muted-foreground text-center">
                Your WC/CC will need to approve before these hours count.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
