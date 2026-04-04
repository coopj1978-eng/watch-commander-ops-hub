import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import backend from "@/lib/backend";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, CheckCircle2, Clock, Users } from "lucide-react";

interface Props {
  userId: string;
  canSettle?: boolean; // true when viewing own profile or as WC
}

const fmt = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

export default function H4HLedgerSection({ userId, canSettle = false }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["h4h-ledger", userId],
    queryFn: () => backend.h4h.list({ user_id: userId, status: "pending" }),
    enabled: !!userId,
  });

  const settleMutation = useMutation({
    mutationFn: (id: number) => backend.h4h.settle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["h4h-ledger", userId] });
      queryClient.invalidateQueries({ queryKey: ["h4h-balance", userId] });
      toast({ title: "H4H marked as settled" });
    },
    onError: () => toast({ title: "Failed to settle", variant: "destructive" }),
  });

  const owedToMe = data?.owed_to_me ?? [];
  const iOwe     = data?.i_owe     ?? [];
  const total    = owedToMe.length + iOwe.length;

  if (isLoading) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">Loading H4H balance…</div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary badges */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <ArrowLeftRight className="h-4 w-4 text-purple-500" />
          <span className="font-medium text-foreground">H4H Balance</span>
        </div>
        <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950/40 dark:border-green-700">
          {owedToMe.length} owed to {canSettle ? "you" : "them"}
        </Badge>
        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700">
          {iOwe.length} outstanding
        </Badge>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center py-8 text-muted-foreground gap-2">
          <CheckCircle2 className="h-8 w-8 text-green-500 opacity-60" />
          <p className="text-sm font-medium">All square — no outstanding H4H shifts</p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* Owed to this person */}
          {owedToMe.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                Owed to {canSettle ? "you" : "them"} ({owedToMe.length})
              </p>
              <div className="space-y-2">
                {owedToMe.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Users className="h-4 w-4 text-green-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{entry.debtor_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Covered shift on {fmt(entry.shift_date)}
                        </p>
                      </div>
                    </div>
                    {canSettle && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs shrink-0 border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-400"
                        disabled={settleMutation.isPending}
                        onClick={() => settleMutation.mutate(entry.id)}
                      >
                        Settled
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* This person owes */}
          {iOwe.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                {canSettle ? "You owe" : "They owe"} ({iOwe.length})
              </p>
              <div className="space-y-2">
                {iOwe.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Users className="h-4 w-4 text-amber-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{entry.creditor_name}</p>
                        <p className="text-xs text-muted-foreground">
                          They covered on {fmt(entry.shift_date)}
                        </p>
                      </div>
                    </div>
                    {canSettle && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-400"
                        disabled={settleMutation.isPending}
                        onClick={() => settleMutation.mutate(entry.id)}
                      >
                        Settled
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
