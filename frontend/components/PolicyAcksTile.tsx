import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import backend from "@/lib/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertTriangle, ChevronRight } from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────────
// PolicyAcksTile — dashboard surface for "policies you still need to
// acknowledge". Only rendered when the caller has outstanding required-but-
// unacked policies. Keeps the dashboard quiet when there's nothing to chase.
//
// Shares the `["policies"]` query cache with the Policies page so there's
// no extra network request — we're just reading a different slice of the
// same list payload.
// ──────────────────────────────────────────────────────────────────────────────
export function PolicyAcksTile() {
  const q = useQuery({
    queryKey: ["policies"],
    queryFn: () => backend.policy.list({ limit: 100 }),
  });

  if (q.isLoading) {
    return (
      <Card className="border-t-2 border-t-brand">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-3 w-full" />
        </CardContent>
      </Card>
    );
  }

  const unackedCount = q.data?.unacked_required_count ?? 0;
  if (unackedCount === 0) return null;

  const unackedPolicies =
    q.data?.policies.filter(
      (p) => p.requires_ack && !p.is_acknowledged
    ) ?? [];

  return (
    <Card className="border-t-2 border-t-red-500 bg-red-50/40 dark:bg-red-950/15">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <CardTitle className="text-sm font-medium">
            Policies awaiting acknowledgement
          </CardTitle>
          <Badge className="text-[10px] bg-red-500 text-white">
            {unackedCount}
          </Badge>
        </div>
        <Link
          to="/policies"
          className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Open Docs
          <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>

      <CardContent className="pt-0">
        <ul className="divide-y divide-border/50">
          {unackedPolicies.slice(0, 3).map((p) => (
            <li key={p.id}>
              <Link
                to="/policies"
                className="flex items-center gap-2 py-2 -mx-1 px-1 rounded hover:bg-background/60 transition-colors"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-red-500 shrink-0" />
                <span className="flex-1 min-w-0 truncate text-sm font-medium">
                  {p.title}
                </span>
                {p.category && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {p.category}
                  </span>
                )}
                {p.version && (
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                    v{p.version}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
        {unackedCount > 3 && (
          <Link
            to="/policies"
            className="block text-center text-xs text-muted-foreground hover:text-foreground mt-2 pt-2 border-t border-border/50"
          >
            +{unackedCount - 3} more
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
