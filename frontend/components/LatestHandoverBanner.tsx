import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, ChevronRight } from "lucide-react";
import { format, formatDistanceToNow, parseISO } from "date-fns";

// ──────────────────────────────────────────────────────────────────────────────
// LatestHandoverBanner
//
// Thin strip pinned above the OperationalStatusBar showing what the previous
// shift left behind — the single thing an incoming WC wants to see first.
//
// Data: reuses the same queryKey as WCHandoverWidget (["wc-latest-handover"])
// so TanStack Query shares the cache and no extra network request is made.
//
// Content priority (first non-empty wins):
//   1. Incidents          (amber)
//   2. Outstanding tasks  (blue)
//   3. General notes      (indigo / muted)
//
// Renders nothing when no handover exists (silent empty state — the widget
// lower down already shows a proper "write first handover" call-to-action).
// ──────────────────────────────────────────────────────────────────────────────

export function LatestHandoverBanner() {
  const { user } = useAuth();
  const watch = user?.watch_unit ?? "";

  const { data, isLoading } = useQuery({
    // Same key as WCHandoverWidget — shared cache, zero extra fetches.
    queryKey: ["wc-latest-handover"],
    queryFn: async () => backend.handover.getLatest({ watch: watch || undefined }),
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="rounded-md border border-border/60 bg-card px-4 py-3 flex items-center gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 flex-1 max-w-md" />
      </div>
    );
  }

  const latest = data?.handover;
  if (!latest) return null;

  // Pick the top-line content — the widget lower down shows the full detail,
  // this banner is deliberately one-line-ish.
  const primary = latest.incidents
    ? { kind: "incidents" as const, text: latest.incidents, label: "Incidents" }
    : latest.outstanding_tasks
    ? { kind: "outstanding" as const, text: latest.outstanding_tasks, label: "Outstanding" }
    : latest.general_notes
    ? { kind: "general" as const, text: latest.general_notes, label: "Notes" }
    : null;

  if (!primary) return null;

  const accentCls =
    primary.kind === "incidents"
      ? "border-l-orange-500"
      : primary.kind === "outstanding"
      ? "border-l-blue-500"
      : "border-l-indigo-500";

  const badgeCls =
    primary.kind === "incidents"
      ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
      : primary.kind === "outstanding"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
      : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300";

  const shiftDateStr = format(parseISO(latest.shift_date), "EEE d MMM");
  const timeAgo = formatDistanceToNow(parseISO(latest.created_at), { addSuffix: true });

  return (
    <Link
      to="/handover?tab=handover"
      className={`group block rounded-md border border-border/60 border-l-4 ${accentCls}
                  bg-card hover:bg-muted/40 transition-colors`}
    >
      <div className="flex items-start gap-3 px-4 py-2.5">
        {/* Icon */}
        <ClipboardList className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />

        {/* Meta column — tiny label + shift context */}
        <div className="shrink-0 space-y-0.5 min-w-0">
          <div className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">
            Last Handover
          </div>
          <div className="text-[11px] text-muted-foreground whitespace-nowrap">
            <span className="font-mono">{shiftDateStr}</span>
            {" · "}
            {latest.shift_type}
            {" · "}
            {latest.written_by_name ?? "Unknown"}
          </div>
        </div>

        {/* Content column — category pill + top-line preview */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${badgeCls}`}>
            {primary.label}
          </span>
          <span className="text-sm text-foreground truncate">
            {primary.text}
          </span>
        </div>

        {/* Right meta + CTA */}
        <div className="shrink-0 hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <span className="whitespace-nowrap">{timeAgo}</span>
          <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </Link>
  );
}
