// The kit editor's heading changes (John, Nov 2026): a locker or a shelf is
// just the name its items share, so renaming or removing a heading is a
// change to every item under it. Names match whatever their capitals or
// outer spaces.

export interface SectionRef {
  locker: string;
  /** Given: just this shelf of the locker. Left out: the whole locker. */
  shelf?: string;
}

const clean = (s: string | null | undefined) => (s ?? "").trim();
const same = (a: string | null | undefined, b: string | null | undefined) => clean(a).toLowerCase() === clean(b).toLowerCase();

/** Is this item under that heading? */
export function inSection(item: { locker: string | null; shelf: string | null }, ref: SectionRef): boolean {
  if (!clean(ref.locker) || !same(item.locker, ref.locker)) return false;
  return ref.shelf === undefined || same(item.shelf, ref.shelf);
}

/** What's wrong with a new heading name, or null. */
export function sectionNameProblem(name: string | undefined | null): string | null {
  const n = clean(name);
  if (!n) return "Give it a name.";
  if (n.length > 80) return "Keep the name under 80 characters.";
  return null;
}

/**
 * The appliance's list in a new order: the ids given, in that order, then
 * anything left out in the order it already had — so a stale screen can't
 * drop an item off the list. Unknown ids are ignored.
 */
export function reordered(current: number[], wanted: number[]): number[] {
  const known = new Set(current);
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of wanted) {
    if (known.has(id) && !seen.has(id)) { seen.add(id); out.push(id); }
  }
  for (const id of current) if (!seen.has(id)) out.push(id);
  return out;
}
