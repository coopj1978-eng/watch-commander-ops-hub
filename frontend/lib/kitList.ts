// An appliance's kit, laid out as the J4 folder has it (John, Nov 2026): by
// locker (or cab), then shelf, in the folder's own order. Kit with no locker
// yet falls back to its type (BA, ladders, hose…), after the lockers.

export interface KitItem {
  locker?: string | null;
  shelf?: string | null;
  category: string;
  sort_order?: number | null;
  name: string;
}

export interface KitShelf<T> {
  /** "Shelf 3", "ToolBox" — empty when the locker isn't split into shelves. */
  name: string;
  items: T[];
}

export interface KitSection<T> {
  /** Stable key for React and for remembering what's open. */
  key: string;
  /** "Offside Front · Locker 7", "Front Cab", or a type such as "Ladders". */
  name: string;
  /** True when it's a real locker or cab, not a fallback type heading. */
  isLocker: boolean;
  shelves: KitShelf<T>[];
  count: number;
}

export const CATEGORY_LABELS: Record<string, string> = {
  BA: "Breathing Apparatus",
  Ladders: "Ladders",
  Hose: "Hose",
  TIC: "Thermal Imaging",
  PPE: "PPE",
  Tools: "Tools",
  Medical: "Medical",
  Other: "Other",
};

const clean = (s?: string | null) => (s ?? "").trim();
const order = (i: KitItem) => i.sort_order ?? 0;

/**
 * Sections in the order their first item comes in the list; shelves the same
 * within a section; items by their place, then name. Lockers come before
 * kit that has no locker.
 */
export function kitSections<T extends KitItem>(items: T[]): KitSection<T>[] {
  const sorted = [...items].sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));
  const sections = new Map<string, KitSection<T>>();
  for (const item of sorted) {
    const locker = clean(item.locker);
    const key = locker ? `locker:${locker.toLowerCase()}` : `type:${item.category}`;
    let section = sections.get(key);
    if (!section) {
      section = {
        key,
        name: locker || CATEGORY_LABELS[item.category] || item.category,
        isLocker: !!locker,
        shelves: [],
        count: 0,
      };
      sections.set(key, section);
    }
    const shelfName = locker ? clean(item.shelf) : "";
    let shelf = section.shelves.find((s) => s.name.toLowerCase() === shelfName.toLowerCase());
    if (!shelf) {
      shelf = { name: shelfName, items: [] };
      section.shelves.push(shelf);
    }
    shelf.items.push(item);
    section.count++;
  }
  const all = [...sections.values()];
  return [...all.filter((s) => s.isLocker), ...all.filter((s) => !s.isLocker)];
}

/** The lockers already used on an appliance, in list order — for picking one when adding kit. */
export function lockersOf(items: KitItem[]): string[] {
  return kitSections(items).filter((s) => s.isLocker).map((s) => s.name);
}

/** "Offside Front · Locker 7 · Shelf 6", "Front Cab", or "" when it has no locker. */
export function whereKept(item: { locker?: string | null; shelf?: string | null }): string {
  return [clean(item.locker), clean(item.locker) ? clean(item.shelf) : ""].filter(Boolean).join(" · ");
}
