// Station contacts (Nov 2026): what a line must have, and who may read the page.

export interface ContactInput {
  section: string;
  name: string;
  detail?: string | null;
  numbers: string;
  note?: string | null;
}

export interface CleanContact {
  section: string;
  name: string;
  detail: string | null;
  numbers: string;
  note: string | null;
}

const tidy = (s: string | null | undefined, max: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** A line ready to save, or the reason it can't be. */
export function cleanContact(input: ContactInput): { contact: CleanContact } | { error: string } {
  const section = tidy(input.section, 60);
  const name = tidy(input.name, 100);
  // Several numbers on one line are split with " / ", however they were typed.
  const numbers = tidy(input.numbers, 200)
    .split(/\s*[/,;]\s*/)
    .map((n) => n.trim())
    .filter(Boolean)
    .join(" / ");
  if (!section) return { error: "Give it a heading to sit under." };
  if (!name) return { error: "Say who or what the number is for." };
  if (!numbers) return { error: "Add a number." };
  if (!/\d/.test(numbers)) return { error: "The number needs some digits in it." };
  return {
    contact: { section, name, detail: tidy(input.detail, 120) || null, numbers, note: tidy(input.note, 300) || null },
  };
}

/**
 * Who may open the page. Watch and Crew Commanders and the admin always can.
 * Firefighters can once its switch is on (Admin → What firefighters see).
 */
export function canReadContacts(
  who: { role: string; isAdmin?: boolean },
  flags: unknown,
): boolean {
  if (who.role === "WC" || who.role === "CC" || who.isAdmin) return true;
  let f: unknown = flags;
  if (typeof f === "string") {
    try { f = JSON.parse(f); } catch { return false; }
  }
  return !!f && typeof f === "object" && (f as Record<string, unknown>).contacts === true;
}
