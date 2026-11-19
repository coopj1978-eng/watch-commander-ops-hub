// Overtime (John, Nov 2026): a shift adjustment with hours, which the app
// adds up per month for each person. Hours only — no pay.

/** What's wrong with these hours, or null: half-hours, from half an hour to a whole day. */
export function overtimeHoursProblem(hours: number | undefined | null): string | null {
  if (hours == null || !Number.isFinite(hours)) return "Say how many hours of overtime were worked.";
  if (hours < 0.5 || hours > 24) return "Overtime hours must be between half an hour and 24.";
  if (Math.round(hours * 2) !== hours * 2) return "Overtime hours go in half-hours (e.g. 4.5).";
  return null;
}
