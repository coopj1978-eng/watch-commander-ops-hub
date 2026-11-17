// How-to guides and regular links (Nov 2026): what a line must have, and who
// may read each page. The admin writes both; everyone else reads.

const tidy = (s: string | null | undefined, max: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * Who may open a page that has a firefighter switch. Watch and Crew
 * Commanders and the admin always can; firefighters once the switch is on
 * (Admin → What firefighters see).
 */
export function canReadSwitched(who: { role: string; isAdmin?: boolean }, flags: unknown, key: string): boolean {
  if (who.role === "WC" || who.role === "CC" || who.isAdmin) return true;
  let f: unknown = flags;
  if (typeof f === "string") {
    try { f = JSON.parse(f); } catch { return false; }
  }
  return !!f && typeof f === "object" && (f as Record<string, unknown>)[key] === true;
}

/** A web address a link may point at: http or https only, never a script. */
export function cleanUrl(raw: string | null | undefined): string | null {
  const url = (raw ?? "").trim();
  if (!url || url.length > 2000) return null;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export interface LinkInput {
  section: string;
  title: string;
  url: string;
  note?: string | null;
}

export function cleanLink(input: LinkInput): { link: { section: string; title: string; url: string; note: string | null } } | { error: string } {
  const section = tidy(input.section, 60);
  const title = tidy(input.title, 100);
  const url = cleanUrl(input.url);
  if (!section) return { error: "Give it a heading to sit under." };
  if (!title) return { error: "Give the link a name." };
  if (!url) return { error: "The address needs to start with http:// or https://" };
  return { link: { section, title, url, note: tidy(input.note, 200) || null } };
}

export interface GuideInput {
  section: string;
  title: string;
  summary?: string | null;
  body: string;
}

export function cleanGuide(input: GuideInput): { guide: { section: string; title: string; summary: string | null; body: string } } | { error: string } {
  const section = tidy(input.section, 60);
  const title = tidy(input.title, 120);
  // The body keeps its line breaks: they are the markup.
  const body = String(input.body ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!section) return { error: "Give it a heading to sit under." };
  if (!title) return { error: "Give the guide a title." };
  if (body.length > 20000) return { error: "That guide is too long. Split it into two." };
  return { guide: { section, title, summary: tidy(input.summary, 160) || null, body } };
}
