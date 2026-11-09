// Who can log a target record. WCs and CCs log everything (John, 1 Nov 2026).
// Since 9 Nov 2026 (John: firefighters should be in on the targets) anyone
// can fill in their OWN watch's home fire safety visits: tick one done, add
// the address and date, and set up the quarter's 36 slots. Community
// engagement, hydrants and removing records stay with WCs and CCs.

export interface Logger {
  role: string;
  /** The caller's watch (users.watch_unit). */
  watchUnit?: string | null;
}

const isManager = (role: string) => role === "WC" || role === "CC";

export function canLogActivity(who: Logger, record: { type: string; watch: string }): boolean {
  if (isManager(who.role)) return true;
  if (record.type !== "hfsv") return false;
  const mine = (who.watchUnit ?? "").trim().toLowerCase();
  return mine !== "" && mine === record.watch.trim().toLowerCase();
}
