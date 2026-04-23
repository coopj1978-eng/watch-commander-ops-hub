import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { parseISO, formatDistanceToNowStrict } from "date-fns";
import backend from "@/lib/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Megaphone, AlertTriangle, ChevronRight } from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────────
// BulletinsTile — compact dashboard surface for unread + unacked bulletins.
//
// Shows up to 3 most-urgent open items with a "View all" link to /bulletins.
// The red border variant kicks in when there's any unacked bulletin with
// requires_ack — those are the ones that genuinely need chasing (SOP
// updates, safety flashes).
//
// Fully fades out of the dashboard when the user is caught up — no empty
// box taking up space. Same pattern as WCHandoverWidget's empty state.
// ──────────────────────────────────────────────────────────────────────────────
export function BulletinsTile() {
  const q = useQuery({
    queryKey: ["bulletin-tile"],
    // Ask for top N unread items — the card is compact, no pagination.
    queryFn: () => backend.bulletin.list({ include_read: false, limit: 5 }),
    // Keep this a relatively cheap call so we can refresh aggressively —
    // a new bulletin should appear without a full page reload.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  if (q.isLoading) {
    return (
      <Card className="border-t-2 border-t-brand">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </CardContent>
      </Card>
    );
  }

  const bulletins = q.data?.bulletins ?? [];
  const unreadCount = q.data?.unread_count ?? 0;
  const unackedCount = q.data?.unacked_count ?? 0;

  if (bulletins.length === 0 && unreadCount === 0) {
    // Caught up — render nothing. Keeps the dashboard quiet when there's
    // genuinely nothing to chase. The Bulletins nav item stays in the
    // sidebar for access.
    return null;
  }

  const needsAck = unackedCount > 0;
  const borderClass = needsAck
    ? "border-t-red-500 bg-red-50/40 dark:bg-red-950/15"
    : "border-t-brand";

  return (
    <Card className={`border-t-2 ${borderClass}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          {needsAck ? (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          ) : (
            <Megaphone className="h-4 w-4 text-brand" />
          )}
          <CardTitle className="text-sm font-medium">
            Bulletins to read
          </CardTitle>
          <Badge
            variant="secondary"
            className={`font-mono tabular-nums ${
              needsAck
                ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300"
                : ""
            }`}
          >
            {unreadCount}
          </Badge>
          {needsAck && (
            <Badge className="text-[10px] bg-red-500 text-white">
              {unackedCount} ack req'd
            </Badge>
          )}
        </div>
        <Link
          to="/bulletins"
          className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View all
          <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>

      <CardContent className="pt-0">
        <ul className="divide-y divide-border/50">
          {bulletins.slice(0, 3).map((b) => {
            const priorityAccent =
              b.priority === "urgent"
                ? "text-red-600 dark:text-red-400"
                : b.priority === "important"
                ? "text-amber-600 dark:text-amber-400"
                : "text-foreground";
            return (
              <li key={b.id}>
                <Link
                  to="/bulletins"
                  className="block py-2 -mx-1 px-1 rounded hover:bg-muted/50 transition-colors"
                >
                  <p
                    className={`text-sm font-medium truncate ${priorityAccent}`}
                  >
                    {b.title}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span>
                      {b.scope === "station"
                        ? "Station-wide"
                        : `${b.watch_unit} Watch`}
                    </span>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{b.posted_by_name ?? "Unknown"}</span>
                    <span className="text-muted-foreground/50">·</span>
                    <span>
                      {formatDistanceToNowStrict(parseISO(b.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                    {b.requires_ack && !b.is_acknowledged && (
                      <span className="ml-auto inline-flex text-[10px] font-semibold text-red-600 dark:text-red-400">
                        ACK required
                      </span>
                    )}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>

        {unreadCount > 3 && (
          <Link
            to="/bulletins"
            className="block text-center text-xs text-muted-foreground hover:text-foreground mt-2 pt-2 border-t border-border/50"
          >
            +{unreadCount - 3} more unread
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
