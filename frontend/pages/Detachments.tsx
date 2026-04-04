import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, differenceInDays } from "date-fns";
import backend from "@/lib/backend";
import { useAuth } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  MapPin, Users, ChevronDown, ChevronRight, Clock, History,
  Trophy, AlertCircle,
} from "lucide-react";

const WATCHES = ["Red", "White", "Green", "Blue", "Amber"] as const;
const PAGE_SIZE = 30;

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const days = differenceInDays(new Date(), parseISO(dateStr));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

// ── Fairness Rota tab ────────────────────────────────────────────────────────

function FairnessRota({ watch }: { watch: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["detachments-rota", watch],
    queryFn:  () => backend.detachments.getRota({ watch }),
    enabled:  !!watch,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const members = data?.members ?? [];

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Users className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No members found for {watch} Watch</p>
        <p className="text-xs text-muted-foreground/60">
          Ensure watch unit is set on each user's profile
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Legend */}
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        Sorted by last detachment — <strong>top of the list = most overdue to go out next</strong>
      </p>

      <div className="space-y-1.5">
        {members.map((m, idx) => {
          const isNext     = idx === 0;
          const neverOut   = !m.last_detachment_date;
          const days       = m.last_detachment_date
            ? differenceInDays(new Date(), parseISO(m.last_detachment_date))
            : null;

          return (
            <div
              key={m.firefighter_id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                isNext
                  ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700"
                  : "bg-background border-border/50 hover:bg-muted/30"
              }`}
            >
              {/* Position badge */}
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                isNext
                  ? "bg-amber-500 text-white"
                  : "bg-muted text-muted-foreground"
              }`}>
                {idx + 1}
              </span>

              {/* Avatar */}
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {m.firefighter_name.split(" ").map(n => n[0]).slice(0, 2).join("")}
              </div>

              {/* Name + last station */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{m.firefighter_name}</span>
                  {isNext && (
                    <Badge className="text-[10px] py-0 px-1.5 bg-amber-500 text-white border-0 shrink-0">
                      Next in line
                    </Badge>
                  )}
                  {neverOut && (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-muted-foreground shrink-0">
                      Never detached
                    </Badge>
                  )}
                </div>
                {m.last_to_station && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 shrink-0" />
                    Last: {m.last_to_station}
                    {m.last_reason && ` · ${m.last_reason}`}
                  </p>
                )}
              </div>

              {/* Right side: last date + count */}
              <div className="text-right shrink-0">
                <p className="text-xs font-medium text-foreground">
                  {m.last_detachment_date
                    ? format(parseISO(m.last_detachment_date), "dd MMM yyyy")
                    : "—"
                  }
                </p>
                <p className={`text-[11px] ${days !== null && days < 30 ? "text-green-600" : "text-muted-foreground"}`}>
                  {daysAgo(m.last_detachment_date)}
                  {m.total_detachments > 0 && ` · ${m.total_detachments}× total`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── History tab ───────────────────────────────────────────────────────────────

function DetachmentHistory({ watch }: { watch: string }) {
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["detachments-history", watch, page],
    queryFn:  () => backend.detachments.list({
      watch: watch || undefined,
      limit:  PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
  });

  const records = data?.detachments ?? [];
  const total   = data?.total       ?? 0;
  const hasMore = (page + 1) * PAGE_SIZE < total;

  if (isLoading && page === 0) {
    return (
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
      </div>
    );
  }

  if (records.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <History className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No detachment records yet</p>
        <p className="text-xs text-muted-foreground/60">
          Records are created automatically when you drag a roster tile to the Detached zone on the crewing board
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{total} record{total !== 1 ? "s" : ""} total</p>

      <div className="space-y-1.5">
        {records.map(det => (
          <div
            key={det.id}
            className="flex items-start gap-3 px-4 py-3 rounded-xl border border-border/50 bg-background hover:bg-muted/30 transition-colors"
          >
            {/* Avatar */}
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
              {det.firefighter_name.split(" ").map(n => n[0]).slice(0, 2).join("")}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{det.firefighter_name}</span>
                <Badge variant="outline" className="text-[10px] py-0 px-1.5">{det.home_watch} Watch</Badge>
                {det.reason && (
                  <span className="text-xs text-muted-foreground">{det.reason}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span>{det.to_station}</span>
                <span className="text-muted-foreground/40">·</span>
                <Clock className="h-3 w-3 shrink-0" />
                <span>{format(parseISO(det.detachment_date), "dd MMM yyyy")}</span>
              </div>
              {det.notes && (
                <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{det.notes}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={() => setPage(p => p + 1)}
          disabled={isLoading}
        >
          <ChevronDown className="h-3.5 w-3.5" />
          Load more ({total - (page + 1) * PAGE_SIZE} remaining)
        </Button>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DetachmentsPage() {
  const { user } = useAuth();
  const [tab,   setTab]   = useState<"rota" | "history">("rota");
  const [watch, setWatch] = useState(user?.watch_unit ?? "White");

  return (
    <div className="space-y-6 max-w-3xl">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MapPin className="h-6 w-6 text-amber-500" />
            Detachment Rota
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track who has been detached and determine who is next in line
          </p>
        </div>

        {/* Watch filter */}
        <Select value={watch} onValueChange={setWatch}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WATCHES.map(w => (
              <SelectItem key={w} value={w}>{w} Watch</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => setTab("rota")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "rota"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Trophy className="h-3.5 w-3.5" />
          Fairness Rota
        </button>
        <button
          onClick={() => setTab("history")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "history"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="h-3.5 w-3.5" />
          History
        </button>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            {tab === "rota" ? `${watch} Watch — Detachment Order` : `${watch} Watch — Detachment History`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tab === "rota"
            ? <FairnessRota watch={watch} />
            : <DetachmentHistory watch={watch} />
          }
        </CardContent>
      </Card>

    </div>
  );
}
