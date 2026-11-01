/**
 * The weekly routine (Nov 2026): a station's routine changes every day but
 * repeats each week, and some checks are done every shift. The Routines
 * planner keeps the cards for each slot — 'every' or a weekday + shift such as
 * 'MO-day' / 'MO-night'. A slot can hold several cards (John's Trello board
 * has "Monday weekly" and "Monday monthly"), each a template with a rule for
 * which weeks it comes round.
 * No Encore imports, so it can be unit-tested directly.
 */

import type { ChecklistItem } from "../task/types";

export const ROUTINE_DAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
const DAY_NAMES: Record<string, string> = {
  MO: "Monday", TU: "Tuesday", WE: "Wednesday", TH: "Thursday", FR: "Friday", SA: "Saturday", SU: "Sunday",
};

export interface RoutineSlotSpec {
  name: string;
  title: string;
  rrule: string;
  per_shift: true;
  shift_only: "day" | "night" | null;
}

/** What a routine slot's template looks like, or null for an unknown slot. */
export function routineSlotSpec(slot: string): RoutineSlotSpec | null {
  if (slot === "every") {
    return { name: "Every shift checks", title: "Every shift checks", rrule: "FREQ=DAILY;INTERVAL=1", per_shift: true, shift_only: null };
  }
  const m = slot.match(/^(MO|TU|WE|TH|FR|SA|SU)-(day|night)$/);
  if (!m) return null;
  const day = DAY_NAMES[m[1]];
  const shift = m[2] as "day" | "night";
  const title = shift === "day" ? `${day} routine` : `${day} night routine`;
  return { name: title, title, rrule: `FREQ=WEEKLY;BYDAY=${m[1]};INTERVAL=1`, per_shift: true, shift_only: shift };
}

/** Which weeks a routine card comes round, on its slot's weekday. */
export const ROUTINE_RULES = ["weekly", "first", "last", "quarter-last"] as const;
export type RoutineRule = (typeof ROUTINE_RULES)[number];

/**
 * Whether a card with this rule is due on a date (its slot's weekday):
 * weekly — every week; first — the first of that weekday in the month;
 * last — the last of it in the month; quarter-last — the last of it in
 * January, April, July and October (e.g. SWAH: last Tuesday of the quarter).
 */
export function routineRuleFires(rule: string | null | undefined, dateIso: string): boolean {
  const [y, m, d] = dateIso.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const isLast = d + 7 > daysInMonth;
  switch (rule ?? "weekly") {
    case "first": return d <= 7;
    case "last": return isLast;
    case "quarter-last": return isLast && [1, 4, 7, 10].includes(m);
    default: return true;
  }
}

/** Item labels from the planner: trimmed, no blanks, no repeats, at most 40. */
export function cleanRoutineItems(labels: string[]): ChecklistItem[] {
  const seen = new Set<string>();
  const items: ChecklistItem[] = [];
  for (const raw of labels) {
    const label = String(raw ?? "").trim().slice(0, 120);
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    items.push({ label, done: false });
    if (items.length >= 40) break;
  }
  return items;
}

/**
 * A template's new checklist applied to a card that's already on the board:
 * items keep their ticks (and who ticked them) by label, new items arrive
 * unticked, and items taken off the template go — unless already ticked, so
 * nobody's work disappears.
 */
export function mergeChecklist(card: ChecklistItem[], template: ChecklistItem[]): ChecklistItem[] {
  const byLabel = new Map(card.map((i) => [i.label.trim().toLowerCase(), i]));
  const merged: ChecklistItem[] = template.map((t) => {
    const had = byLabel.get(t.label.trim().toLowerCase());
    return had ? { ...had, label: t.label } : { label: t.label, done: false };
  });
  const kept = new Set(template.map((t) => t.label.trim().toLowerCase()));
  for (const i of card) if (i.done && !kept.has(i.label.trim().toLowerCase())) merged.push(i);
  return merged;
}

/**
 * Who ticked what: items newly ticked get the person and time, items that
 * stay ticked keep what the server already had (never the client's copy),
 * and unticked items lose them. Matched by label, then by position.
 */
export function stampChecklist(
  before: ChecklistItem[],
  after: ChecklistItem[],
  who: { id: string; name: string | null },
  now: Date = new Date(),
): ChecklistItem[] {
  const byLabel = new Map(before.map((i) => [i.label, i]));
  return after.map((item, idx) => {
    const { done_by, done_by_name, done_at, ...plain } = item;
    if (!item.done) return { ...plain, done: false };
    const old = byLabel.get(item.label) ?? (before[idx]?.label === item.label ? before[idx] : undefined);
    if (old?.done && old.done_by) {
      return { ...plain, done: true, done_by: old.done_by, done_by_name: old.done_by_name, done_at: old.done_at };
    }
    if (old?.done) return { ...plain, done: true };
    return { ...plain, done: true, done_by: who.id, done_by_name: who.name ?? undefined, done_at: now.toISOString() };
  });
}
