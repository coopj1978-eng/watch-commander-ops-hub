import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCheck,
  AlertTriangle,
  ShieldCheck,
  ShieldOff,
  CircleCheck,
  CircleDashed,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { policy } from "@/client";

// ──────────────────────────────────────────────────────────────────────────────
// PolicyAckControls
//
// Drop-in row of controls for the Policies page:
//   • FF / CC view: ack status badge + "Mark as read" button when the policy
//     requires acknowledgement and they haven't ack'd the current version.
//   • WC view: same as above, plus a "Require ack" toggle + expandable
//     read-receipts panel.
//
// Kept small and inline so the existing grid / table layouts on /policies
// don't need a restructure — each row just renders <PolicyAckControls />
// alongside the existing Download button.
// ──────────────────────────────────────────────────────────────────────────────
export function PolicyAckControls({
  policyDoc,
  compact = false,
}: {
  policyDoc: policy.PolicyDoc;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isWC = user?.role === "WC";
  const isWCorCC = isWC || user?.role === "CC";

  const [showReceipts, setShowReceipts] = useState(false);

  const ackMutation = useMutation({
    mutationFn: () => backend.policy.acknowledge(policyDoc.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      queryClient.invalidateQueries({ queryKey: ["policy-stats", policyDoc.id] });
      queryClient.invalidateQueries({ queryKey: ["policy-acks-tile"] });
      toast({ title: "Acknowledged", description: policyDoc.title });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (next: boolean) =>
      backend.policy.setRequiresAck(policyDoc.id, { requires_ack: next }),
    onSuccess: (_, next) => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      queryClient.invalidateQueries({ queryKey: ["policy-stats", policyDoc.id] });
      queryClient.invalidateQueries({ queryKey: ["policy-acks-tile"] });
      toast({
        title: next
          ? "Acknowledgement required"
          : "Acknowledgement no longer required",
      });
    },
  });

  // Status badge — one source of truth for "what does this policy mean to me"
  let statusBadge: React.ReactNode = null;
  if (policyDoc.requires_ack) {
    if (policyDoc.is_acknowledged) {
      statusBadge = (
        <Badge
          variant="outline"
          className="gap-1 bg-green-50 border-green-300 text-green-700 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900"
        >
          <CheckCheck className="h-3 w-3" />
          Acknowledged
        </Badge>
      );
    } else {
      statusBadge = (
        <Badge className="gap-1 bg-red-100 text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900">
          <AlertTriangle className="h-3 w-3" />
          ACK required
        </Badge>
      );
    }
  } else if (policyDoc.is_acknowledged) {
    statusBadge = (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <CheckCheck className="h-3 w-3" />
        Acked
      </Badge>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "mt-2"}`}>
      {statusBadge}

      {/* Acknowledge button — shown when the policy requires it and the
          caller hasn't yet acked the current version. */}
      {policyDoc.requires_ack && !policyDoc.is_acknowledged && (
        <Button
          size="sm"
          className="h-7 text-xs bg-brand hover:bg-brand/90 text-brand-foreground"
          disabled={ackMutation.isPending}
          onClick={() => ackMutation.mutate()}
        >
          <CheckCheck className="h-3.5 w-3.5 mr-1" />
          I've read &amp; understood
        </Button>
      )}

      {/* WC toggle — flip requires_ack on / off. */}
      {isWC && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={toggleMutation.isPending}
          onClick={() => toggleMutation.mutate(!policyDoc.requires_ack)}
          title={
            policyDoc.requires_ack
              ? "Stop requiring acknowledgement"
              : "Require every crew member to acknowledge this policy"
          }
        >
          {policyDoc.requires_ack ? (
            <>
              <ShieldOff className="h-3.5 w-3.5 mr-1" />
              Stop requiring ack
            </>
          ) : (
            <>
              <ShieldCheck className="h-3.5 w-3.5 mr-1" />
              Require ack
            </>
          )}
        </Button>
      )}

      {/* Receipts toggle — WC/CC see an expandable list of who's acked
          the current version. Only surfaced when requires_ack is on
          (otherwise it's noise). */}
      {isWCorCC && policyDoc.requires_ack && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs ml-auto"
          onClick={() => setShowReceipts((v) => !v)}
        >
          <Users className="h-3.5 w-3.5 mr-1" />
          Receipts
          {showReceipts ? (
            <ChevronUp className="h-3.5 w-3.5 ml-1" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 ml-1" />
          )}
        </Button>
      )}

      {showReceipts && (
        <div className="w-full mt-2">
          <PolicyAckReceipts id={policyDoc.id} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PolicyAckReceipts — per-user ack table. Only queried when expanded.
// ─────────────────────────────────────────────────────────────────────────────
function PolicyAckReceipts({ id }: { id: number }) {
  const q = useQuery({
    queryKey: ["policy-stats", id],
    queryFn: () => backend.policy.getStats(id),
    staleTime: 30_000,
  });

  if (q.isLoading) {
    return (
      <div className="space-y-1.5">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    );
  }

  const data = q.data;
  if (!data) return null;
  const { policy: p, audience } = data;

  const pct =
    p.audience_count && p.audience_count > 0
      ? Math.round(((p.acknowledged_count ?? 0) / p.audience_count) * 100)
      : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <h4 className="font-semibold uppercase tracking-wide text-muted-foreground">
          Acknowledgements
        </h4>
        <span className="text-muted-foreground font-mono tabular-nums">
          {p.acknowledged_count ?? 0}/{p.audience_count ?? 0}{" "}
          <span className="text-muted-foreground/60">({pct}%)</span>
        </span>
      </div>
      <ul className="divide-y divide-border/60 border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
        {audience.map((a) => {
          const acked = !!a.acknowledged_at;
          return (
            <li
              key={a.user_id}
              className="flex items-center gap-3 px-3 py-1.5 text-xs"
            >
              {acked ? (
                <CircleCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
              ) : (
                <CircleDashed className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
              )}
              <span className="flex-1 min-w-0 truncate font-medium">
                {a.name}
              </span>
              {a.rank && (
                <span className="text-muted-foreground shrink-0">{a.rank}</span>
              )}
              {a.watch_unit && (
                <span className="text-muted-foreground shrink-0">
                  {a.watch_unit}
                </span>
              )}
              <span className="text-muted-foreground shrink-0 min-w-[110px] text-right font-mono tabular-nums">
                {acked
                  ? `Acked ${format(parseISO(a.acknowledged_at!), "d MMM HH:mm")}`
                  : "Not acked"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
