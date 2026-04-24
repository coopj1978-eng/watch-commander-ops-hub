import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────────
// AbsenceTriggersCard
//
// Right-column card matching the original design mockup. Lists staff with
// active absence situations grouped by severity:
//   • Stage 3 — sickness triggers at the highest level, "One-to-one required"
//   • Stage 2 — pending management review
//   • Stage 1 — monitor
//   • Annual leave — current + upcoming so the WC can eyeball cover gaps
//
// Reuses the existing profile + absence query caches so no extra network
// traffic. Everything stacks in order of operational urgency: sickness
// triggers first (red → amber → yellow), then leave (neutral blue).
// ──────────────────────────────────────────────────────────────────────────────

interface TriggerItem {
  user_id: string;
  name: string;
  subtitle: string;
  action?: string;
  badge: { label: string; className: string };
}

export function AbsenceTriggersCard() {
  const { user } = useAuth();
  const watch = user?.watch_unit ?? "";

  const profilesQ = useQuery({
    queryKey: ["wc-profiles-with-users"],
    queryFn: async () => backend.profile.listWithUsers({ limit: 500 }),
  });

  const absencesQ = useQuery({
    queryKey: ["wc-absences-today"],
    queryFn: async () =>
      backend.absence.list({
        status: "approved",
        start_date: new Date().toISOString().split("T")[0],
        end_date: new Date().toISOString().split("T")[0],
        limit: 200,
      }),
  });

  const statsQ = useQuery({
    queryKey: ["wc-crew-stats"],
    queryFn: async () => backend.crew.getStats(),
  });

  const isLoading = profilesQ.isLoading || absencesQ.isLoading || statsQ.isLoading;

  // Build the grouped list. This runs post-isLoading so we can trust the
  // data shapes, but we put the hook call above so it's always ordered.
  const items: TriggerItem[] = useMemo(() => {
    if (isLoading) return [];

    const watchMemberIds = new Set(statsQ.data?.watch_member_ids ?? []);
    const profiles = (profilesQ.data?.people ?? []).filter(
      (p: any) => !watch || watchMemberIds.has(p.user.id)
    );

    const stage3: TriggerItem[] = [];
    const stage2: TriggerItem[] = [];
    const stage1: TriggerItem[] = [];

    for (const row of profiles as any[]) {
      const userRec = row.user;
      const prof = row.profile;
      if (!prof) continue;
      const episodes = prof.rolling_sick_episodes ?? 0;
      const days = prof.rolling_sick_days ?? 0;
      const summary = `Sickness — ${episodes} episode${
        episodes === 1 ? "" : "s"
      } in 6 months`;

      if (prof.trigger_stage === "Stage3") {
        stage3.push({
          user_id: userRec.id,
          name: userRec.name,
          subtitle: summary,
          action: "One-to-one required",
          badge: {
            label: "STAGE 3",
            className:
              "bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
          },
        });
      } else if (prof.trigger_stage === "Stage2") {
        stage2.push({
          user_id: userRec.id,
          name: userRec.name,
          subtitle: summary,
          action: "Management review",
          badge: {
            label: "STAGE 2",
            className:
              "bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900",
          },
        });
      } else if (prof.trigger_stage === "Stage1") {
        stage1.push({
          user_id: userRec.id,
          name: userRec.name,
          subtitle: summary,
          action: "Monitor",
          badge: {
            label: "STAGE 1",
            className:
              "bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-900",
          },
        });
      }
    }

    // People on approved leave today — annual, parental, etc. Shown at
    // the bottom so the WC can see the full absence picture in one view.
    const leaveToday = (absencesQ.data?.absences ?? [])
      .filter(
        (a: any) =>
          a.type !== "sickness" &&
          (watchMemberIds.size === 0 || watchMemberIds.has(a.firefighter_id))
      )
      .slice(0, 6);

    const nameById = new Map<string, string>();
    for (const row of profiles as any[]) {
      if (row.user) nameById.set(row.user.id, row.user.name);
    }

    const leave: TriggerItem[] = leaveToday.map((a: any) => {
      const start = new Date(a.start_date);
      const end = new Date(a.end_date);
      const days =
        Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000)) + 1;
      const leaveLabel =
        a.type === "annual_leave"
          ? "Annual leave"
          : a.type === "parental"
          ? "Parental"
          : a.type === "training"
          ? "Training"
          : "Leave";
      return {
        user_id: a.firefighter_id,
        name: nameById.get(a.firefighter_id) ?? a.firefighter_name ?? "Unknown",
        subtitle: `${leaveLabel}, ${days} day${days === 1 ? "" : "s"}`,
        badge: {
          label: "AL",
          className:
            "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
        },
      };
    });

    return [...stage3, ...stage2, ...stage1, ...leave];
  }, [isLoading, profilesQ.data, absencesQ.data, statsQ.data, watch]);

  const activeCount = items.filter((i) => i.badge.label !== "AL").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium">Absence triggers</CardTitle>
        {activeCount > 0 && (
          <Badge className="text-[10px] font-semibold uppercase tracking-widest bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900">
            {activeCount} active
          </Badge>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No active absences on your watch.
          </p>
        ) : (
          <ul className="divide-y divide-border/50 -mx-2">
            {items.map((item, i) => (
              <li key={`${item.user_id}-${i}`}>
                <Link
                  to={`/people/${encodeURIComponent(item.user_id)}`}
                  className="flex items-start gap-3 px-2 py-3 hover:bg-muted/40 transition-colors rounded"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {item.subtitle}
                    </p>
                    {item.action && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
                        {item.action}
                      </p>
                    )}
                  </div>
                  <Badge
                    className={`text-[10px] font-semibold uppercase tracking-widest shrink-0 ${item.badge.className}`}
                  >
                    {item.badge.label}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
