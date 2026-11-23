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

/**
 * A typed or pasted web address made safe to keep: http(s) only, "https://"
 * added when it was left off. Null when it isn't an address. (The same rule
 * as the app's tidyUrl, so what it saves comes back unchanged.)
 */
export function cleanLinkUrl(input: unknown): string | null {
  const raw = String(input ?? "").trim();
  if (!raw || /\s/.test(raw) || raw.length > 2000) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Item labels from the planner: trimmed, no blanks, no repeats, at most 40.
 * `urls` (same order as the labels) links an item's wording somewhere; a
 * blank or unusable one leaves the item unlinked.
 */
export function cleanRoutineItems(labels: string[], urls?: (string | null | undefined)[]): ChecklistItem[] {
  const seen = new Set<string>();
  const items: ChecklistItem[] = [];
  for (const [i, raw] of labels.entries()) {
    const label = String(raw ?? "").trim().slice(0, 120);
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    const url = cleanLinkUrl(urls?.[i]);
    items.push(url ? { label, done: false, url } : { label, done: false });
    if (items.length >= 40) break;
  }
  return items;
}

/**
 * The links an item already had, by wording — for a save from an older copy
 * of the app that doesn't send them, so they aren't lost.
 */
export function urlsByLabel(existing: ChecklistItem[], labels: string[]): (string | null)[] {
  const byLabel = new Map(existing.filter((i) => i.url).map((i) => [norm(i.label), i.url!]));
  return labels.map((l) => byLabel.get(norm(String(l ?? ""))) ?? null);
}

const linkUrlOf = (stored: string) => (stored.split("\n").pop() ?? "").trim();

/**
 * A routine card's own links, as a task card keeps them: the address, or a
 * name and the address on two lines. Web addresses only, no repeats, at most 10.
 */
export function cleanCardLinks(links: unknown): string[] {
  if (!Array.isArray(links)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of links) {
    const lines = String(raw ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
    const url = cleanLinkUrl(lines.pop());
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const name = lines.join(" ").replace(/\s+/g, " ").slice(0, 80);
    out.push(name ? `${name}\n${url}` : url);
    if (out.length >= 10) break;
  }
  return out;
}

/**
 * A card on the board after its routine card's links change: the routine's
 * links first, then any the card was given of its own that day.
 */
export function mergeCardLinks(card: string[] | null | undefined, oldTemplate: string[], newTemplate: string[]): string[] {
  const fromTemplate = new Set([...oldTemplate, ...newTemplate].map(linkUrlOf));
  const own = (card ?? []).filter((a) => !fromTemplate.has(linkUrlOf(a)));
  return [...newTemplate, ...own];
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * A line reworded in place: the list is the same length, the old wording at
 * that position is gone and the new wording wasn't there before. Its tick
 * (and who ticked it) belongs to the new wording.
 */
function rewordedFrom(before: ChecklistItem[], afterLabels: string[], idx: number): ChecklistItem | undefined {
  const old = before[idx];
  if (!old || before.length !== afterLabels.length) return undefined;
  if (afterLabels.some((l) => norm(l) === norm(old.label))) return undefined;
  if (before.some((b) => norm(b.label) === norm(afterLabels[idx]))) return undefined;
  return old;
}

/**
 * A template's new checklist applied to a card that's already on the board:
 * items keep their ticks (and who ticked them) by label, a reworded item
 * keeps its tick, new items arrive unticked, and items taken off the
 * template go — unless already ticked, so nobody's work disappears. Each
 * item's link is the template's.
 */
export function mergeChecklist(card: ChecklistItem[], template: ChecklistItem[]): ChecklistItem[] {
  const byLabel = new Map(card.map((i) => [norm(i.label), i]));
  const labels = template.map((t) => t.label);
  const used = new Set<ChecklistItem>();
  const merged: ChecklistItem[] = template.map((t, idx) => {
    const had = byLabel.get(norm(t.label)) ?? rewordedFrom(card, labels, idx);
    if (had) used.add(had);
    const { url: _old, ...item } = had ? { ...had, label: t.label } : { label: t.label, done: false };
    // The wording's link is the template's to set.
    return t.url ? { ...item, url: t.url } : item;
  });
  const kept = new Set(template.map((t) => norm(t.label)));
  for (const i of card) if (i.done && !used.has(i) && !kept.has(norm(i.label))) merged.push(i);
  return merged;
}

/**
 * For someone who may tick a card but not change it: the card's own lines,
 * with only their ticks applied. Lines they added, removed or reworded are
 * ignored, so an out-of-date screen can't undo someone else's edit.
 */
export function ticksOnly(before: ChecklistItem[], after: ChecklistItem[]): ChecklistItem[] {
  const want = new Map(after.map((i) => [i.label, !!i.done]));
  return before.map((i) => (want.has(i.label) ? { ...i, done: want.get(i.label)! } : i));
}

/**
 * Who ticked what: items newly ticked get the person and time, items that
 * stay ticked keep what the server already had (never the client's copy),
 * and unticked items lose them. Matched by label; a line reworded in place
 * keeps the tick it had.
 */
export function stampChecklist(
  before: ChecklistItem[],
  after: ChecklistItem[],
  who: { id: string; name: string | null },
  now: Date = new Date(),
): ChecklistItem[] {
  const byLabel = new Map(before.map((i) => [i.label, i]));
  const labels = after.map((i) => i.label);
  return after.map((item, idx) => {
    const { done_by, done_by_name, done_at, ...plain } = item;
    if (!item.done) return { ...plain, done: false };
    const old = byLabel.get(item.label) ?? rewordedFrom(before, labels, idx);
    if (old?.done && old.done_by) {
      return { ...plain, done: true, done_by: old.done_by, done_by_name: old.done_by_name, done_at: old.done_at };
    }
    if (old?.done) return { ...plain, done: true };
    return { ...plain, done: true, done_by: who.id, done_by_name: who.name ?? undefined, done_at: now.toISOString() };
  });
}
