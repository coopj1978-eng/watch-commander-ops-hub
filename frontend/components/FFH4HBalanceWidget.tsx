import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeftRight, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function FFH4HBalanceWidget() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["h4h-balance", user?.id],
    queryFn: () => backend.h4h.list({ user_id: user!.id, status: "pending" }),
    enabled: !!user?.id,
  });

  const owedToMe = data?.owed_to_me?.length ?? 0;
  const iOwe     = data?.i_owe?.length     ?? 0;
  const total    = owedToMe + iOwe;

  const accentColor = iOwe > 0
    ? "border-t-amber-500"
    : owedToMe > 0
      ? "border-t-green-500"
      : "border-t-purple-500";

  return (
    <Card className={`border-t-2 ${accentColor}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5 text-purple-500" />
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            H4H Balance
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-3">Loading…</p>
        ) : total === 0 ? (
          <div className="flex flex-col items-center py-4 gap-2 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-green-500 opacity-70" />
            <p className="text-sm font-medium text-foreground">All square</p>
            <p className="text-xs text-muted-foreground text-center">No outstanding H4H shifts</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Stat row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 p-3 text-center">
                <p className="text-4xl font-bold text-green-600 dark:text-green-400">{owedToMe}</p>
                <p className="text-xs text-green-700 dark:text-green-400 mt-0.5 font-medium">Owed to you</p>
              </div>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 text-center">
                <p className="text-4xl font-bold text-amber-600 dark:text-amber-400">{iOwe}</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 font-medium">You owe</p>
              </div>
            </div>

            {/* Quick list of names */}
            {data?.i_owe && data.i_owe.length > 0 && (
              <div className="space-y-1">
                {data.i_owe.slice(0, 3).map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-xs text-muted-foreground px-1">
                    <span className="truncate">{e.creditor_name}</span>
                    <span className="shrink-0 ml-2 text-amber-500 font-medium">owes you back</span>
                  </div>
                ))}
                {data.i_owe.length > 3 && (
                  <p className="text-xs text-muted-foreground pl-1">+{data.i_owe.length - 3} more</p>
                )}
              </div>
            )}
          </div>
        )}

        <Link
          to="/profile"
          className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-border/40 text-xs text-muted-foreground hover:text-indigo-600 transition-colors"
        >
          View full ledger →
        </Link>
      </CardContent>
    </Card>
  );
}
