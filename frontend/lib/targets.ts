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
