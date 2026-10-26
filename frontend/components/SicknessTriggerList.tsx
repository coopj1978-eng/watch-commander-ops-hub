import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import backend from "@/lib/backend";

// Who has hit their absence triggers — each name opens their profile, so the
// dashboard takes a WC/CC straight to the person rather than the staff list.
// No stage is shown: that's the Station Commander's note on the attendance file.

const STAGE_STYLE: Record<string, string> = {
  Stage3: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  Stage2: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  Stage1: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
};

export function SicknessTriggerList({ profiles, max = 5 }: { profiles: { user_id: string; trigger_stage?: string | null }[]; max?: number }) {
  const { data: people } = useQuery({
    queryKey: ["people-for-tasks"],
    queryFn: async () => (await backend.profile.listWithUsers({ limit: 500 })).people ?? [],
    staleTime: 5 * 60 * 1000,
  });
  const nameOf = (id: string) => {
    const p = (people ?? []).find((x) => x.user.id === id);
    return p?.user.name || p?.user.email?.split("@")[0] || "Unknown";
  };
  const flagged = profiles
    .filter((p) => p.trigger_stage && p.trigger_stage in STAGE_STYLE)
    .sort((a, b) => String(b.trigger_stage).localeCompare(String(a.trigger_stage)));
  if (flagged.length === 0) return null;

  return (
    <ul className="mt-2 space-y-1">
      {flagged.slice(0, max).map((p) => (
        <li key={p.user_id}>
          <Link to={`/people/${p.user_id}`} className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-muted/60 hover:text-primary transition-colors">
            <span className="truncate font-medium">{nameOf(p.user_id)}</span>
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              Triggers hit
            </span>
          </Link>
        </li>
      ))}
      {flagged.length > max && <li className="px-1 text-xs text-muted-foreground">+{flagged.length - max} more</li>}
    </ul>
  );
}
