// Routine cards' "how often" (Nov 2026, from John's Trello board): a weekday
// can have a weekly card plus monthly and quarterly ones that only come round
// in their week. Same rule as the server's routineRuleFires (lib/routine.ts).

export type RoutineRule = "weekly" | "first" | "last" | "quarter-last";

export const DAY_NAMES: Record<string, string> = {
  MO: "Monday", TU: "Tuesday", WE: "Wednesday", TH: "Thursday", FR: "Friday", SA: "Saturday", SU: "Sunday",
};

/** "Weekly", "Monthly · 1st Monday", "Quarterly · last Tuesday of Jan, Apr, Jul, Oct". */
export function ruleLabel(rule: string | null | undefined, dayKey: string | undefined, short = false): string {
  const day = dayKey ? DAY_NAMES[dayKey] ?? "" : "";
  const d = short ? day.slice(0, 3) : day;
  switch (rule) {
    case "first": return `Monthly · 1st ${d}`;
    case "last": return `Monthly · last ${d}`;
    case "quarter-last": return short ? `Quarterly · last ${d}` : `Quarterly · last ${d} of Jan, Apr, Jul, Oct`;
    default: return "Weekly";
  }
}

export const RULE_OPTIONS: { rule: RoutineRule; label: (day: string) => string }[] = [
  { rule: "weekly", label: () => "Every week" },
  { rule: "first", label: (d) => `1st ${d} of the month` },
  { rule: "last", label: (d) => `Last ${d} of the month` },
  { rule: "quarter-last", label: (d) => `Last ${d} of Jan, Apr, Jul and Oct` },
];

/** Whether a card with this rule is due on a date (its slot's weekday). */
export function routineRuleFires(rule: string | null | undefined, dateIso: string): boolean {
  const [y, m, d] = dateIso.split("-").map(Number);
  const isLast = d + 7 > new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (rule === "first") return d <= 7;
  if (rule === "last") return isLast;
  if (rule === "quarter-last") return isLast && [1, 4, 7, 10].includes(m);
  return true;
}
