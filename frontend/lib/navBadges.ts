import { useQuery } from "@tanstack/react-query";
import backend from "@/lib/backend";
import { useAuth } from "@/App";
import type { NavBadgeKey } from "@/lib/navigation";

// Live counts beside menu items. Colour only for problems: red when something
// is overdue or expired, amber when it's due, plain for unread news.
// Same query keys as the dashboard's "Needs you" list, so a page that already
// fetched them costs nothing extra.

export type BadgeTone = "alert" | "warn" | "neutral";

export interface NavBadge {
  count: number;
  tone: BadgeTone;
  /** e.g. "2 overdue" — the tooltip / screen-reader text. */
  hint: string;
}

const quiet = { staleTime: 60_000, retry: false, refetchOnWindowFocus: true } as const;

export function useNavBadges(): Partial<Record<NavBadgeKey, NavBadge>> {
  const { user } = useAuth();
  const isManager = user?.role === "WC" || user?.role === "CC";

  const { data: crewStats } = useQuery({
    queryKey: ["wc-crew-stats"],
    queryFn: () => backend.crew.getStats(),
    enabled: !!user,
    ...quiet,
  });

  const { data: unread } = useQuery({
    queryKey: ["bulletin-tile", "unread-count"],
    queryFn: () => backend.bulletin.list({ include_read: false, limit: 1 }),
    enabled: !!user,
    ...quiet,
  });

  const { data: btw } = useQuery({
    queryKey: ["back-to-work", "due"],
    queryFn: () => backend.absence.listBackToWork({}),
    enabled: isManager,
    ...quiet,
  });

  const { data: skills } = useQuery({
    queryKey: ["wc-skills-expiring"],
    queryFn: () => backend.skill.listExpiring(),
    enabled: isManager,
    ...quiet,
  });

  const badges: Partial<Record<NavBadgeKey, NavBadge>> = {};

  const overdue = crewStats?.overdue_tasks ?? 0;
  if (overdue > 0) badges.tasks = { count: overdue, tone: "alert", hint: `${overdue} overdue` };

  const news = unread?.total ?? 0;
  if (news > 0) badges.bulletins = { count: news, tone: "neutral", hint: `${news} unread` };

  if (isManager) {
    const interviews = btw?.interviews.length ?? 0;
    const expired = skills?.expired_count ?? 0;
    const parts = [
      expired > 0 && `${expired} expired cert${expired === 1 ? "" : "s"}`,
      interviews > 0 && `${interviews} back-to-work due`,
    ].filter(Boolean);
    if (expired + interviews > 0) {
      badges.people = { count: expired + interviews, tone: expired > 0 ? "alert" : "warn", hint: parts.join(" · ") };
    }
  }

  return badges;
}
