// Quarterly performance targets — the single source for the Targets page,
// its Year at a Glance table, and the dashboard Performance Summary.
export const HFSV_TARGET_Q = 36;

// 6 community engagements a quarter, of which at least 3 must be TAP-type.
export const COMMUNITY_TARGET_Q = 6;
export const COMMUNITY_TAP_MIN = 3;

/** Community is only met when both the total and the TAP minimum are reached. */
export function communityMet(completed: number, tapCompleted: number): boolean {
  return completed >= COMMUNITY_TARGET_Q && tapCompleted >= COMMUNITY_TAP_MIN;
}

/**
 * This calendar month so far (Nov 2026: firefighters see "how far along we
 * are this month"). Counts dates falling in `now`'s month, local time. The
 * monthly figure is the quarter's target split three ways — a pace, not a
 * separate target.
 */
export function thisMonth(dates: (string | null | undefined)[], quarterTarget: number, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const count = dates.filter((d) => {
    if (!d) return false;
    const t = new Date(d);
    return t.getFullYear() === y && t.getMonth() === m;
  }).length;
  return {
    month: now.toLocaleDateString("en-GB", { month: "long" }),
    count,
    pace: Math.round(quarterTarget / 3),
  };
}
