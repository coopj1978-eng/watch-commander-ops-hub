// Links on a task card (Trello's "attach a link"). They live in the task's
// `attachments` list, one string each: just the address, or a name and the
// address on two lines ("Risk assessment\nhttps://…").

export interface TaskLink {
  url: string;
  /** What to show; the site name when no name was given. */
  label: string;
  /** True when the person gave it a name of their own. */
  named: boolean;
}

/** "firescotland.sharepoint.com" from an address — shown when a link has no name. */
export function linkHost(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

/**
 * A typed or pasted address made safe to open: web links only (http/https),
 * "https://" added when it was left off. Null when it isn't an address.
 */
export function tidyUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw || /\s/.test(raw)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
    return u.toString();
  } catch { return null; }
}

/** One stored string → a link, or null when it isn't one (old data, a file name). */
export function parseTaskLink(stored: string): TaskLink | null {
  const lines = stored.split("\n").map((l) => l.trim()).filter(Boolean);
  // What's stored always has its http(s):// — anything else isn't one of ours.
  const last = lines[lines.length - 1] ?? "";
  const url = /^https?:\/\//i.test(last) ? tidyUrl(last) : null;
  if (!url) return null;
  const name = lines.length > 1 ? lines.slice(0, -1).join(" ") : "";
  return { url, label: name || linkHost(url), named: !!name };
}

/** A link → the string that's stored. */
export function formatTaskLink(url: string, name?: string): string {
  const n = (name ?? "").replace(/\s+/g, " ").trim();
  return n ? `${n}\n${url}` : url;
}

/** The links among a task's attachments, each with its place in the list. */
export function taskLinks(attachments: string[] | undefined | null): (TaskLink & { index: number })[] {
  return (attachments ?? []).flatMap((a, index) => {
    const l = parseTaskLink(a);
    return l ? [{ ...l, index }] : [];
  });
}
