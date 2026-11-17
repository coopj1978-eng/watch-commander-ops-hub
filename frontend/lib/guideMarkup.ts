// How-to guides (Nov 2026) are written in a few plain-text marks, so the
// admin can edit one in a text box and it still reads like a procedure:
//
//   ## Heading            a sub-heading
//   1. Sign in            steps, in order ("- [ ] Sign in" counts as a step too)
//   - Bring the form      points, in no order
//   > Station PCs only    a note
//   **bold**, [label](https://…), and bare web addresses
//
// Anything else is a paragraph. Nothing here produces HTML: the page draws
// each block itself, and a link is only a link if it is http(s) or mailto.

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "link"; text: string; href: string };

export type Block =
  | { kind: "heading"; text: Inline[] }
  | { kind: "steps"; items: Inline[][] }
  | { kind: "bullets"; items: Inline[][] }
  | { kind: "note"; lines: Inline[][] }
  | { kind: "para"; lines: Inline[][] };

const SAFE_HREF = /^(https?:\/\/|mailto:)/i;
const INLINE = /\*\*(.+?)\*\*|\[([^\]\n]+)\]\(([^)\s]+)\)|((?:https?:\/\/|mailto:)[^\s<>()]+[^\s<>().,;:!?'"])/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: "text", text: text.slice(last, at) });
    if (m[1] !== undefined) out.push({ kind: "bold", text: m[1] });
    else if (m[2] !== undefined) {
      // A label with an address that isn't a web or mail link stays as words.
      out.push(SAFE_HREF.test(m[3]) ? { kind: "link", text: m[2], href: m[3] } : { kind: "text", text: m[2] });
    } else if (m[4] !== undefined) {
      out.push({ kind: "link", text: m[4].replace(/^mailto:/i, ""), href: m[4] });
    }
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

const STEP = /^\s*(?:\d+[.)]\s+|[-*]\s+\[[ xX]?\]\s*)(.*)$/;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const NOTE = /^\s*>\s?(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

export function parseGuide(body: string): Block[] {
  const blocks: Block[] = [];
  const push = (b: Block) => blocks.push(b);
  for (const raw of body.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const prev = blocks[blocks.length - 1];
    if (!line.trim()) {
      // A blank line ends a paragraph or note; lists carry on across one.
      if (prev && (prev.kind === "para" || prev.kind === "note")) push({ kind: "para", lines: [] });
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = line.match(HEADING))) push({ kind: "heading", text: parseInline(m[1]) });
    else if ((m = line.match(STEP))) {
      if (!m[1].trim()) continue; // an empty checkbox
      if (prev?.kind === "steps") prev.items.push(parseInline(m[1]));
      else push({ kind: "steps", items: [parseInline(m[1])] });
    } else if ((m = line.match(BULLET))) {
      if (prev?.kind === "bullets") prev.items.push(parseInline(m[1]));
      else push({ kind: "bullets", items: [parseInline(m[1])] });
    } else if ((m = line.match(NOTE))) {
      if (prev?.kind === "note") prev.lines.push(parseInline(m[1]));
      else push({ kind: "note", lines: [parseInline(m[1])] });
    } else if (prev?.kind === "para") prev.lines.push(parseInline(line.trim()));
    else push({ kind: "para", lines: [parseInline(line.trim())] });
  }
  return blocks.filter((b) => !(b.kind === "para" && b.lines.length === 0));
}

/** How many steps a guide has — shown on its card ("6 steps"). */
export function stepCount(body: string): number {
  return parseGuide(body).reduce((n, b) => (b.kind === "steps" ? n + b.items.length : n), 0);
}

export interface Sectioned {
  id: number;
  section: string;
  position: number;
}

/** Lines grouped under their headings, sections in the order their first line sits. */
export function bySection<T extends Sectioned>(lines: T[]): { section: string; lines: T[] }[] {
  const out: { section: string; lines: T[] }[] = [];
  const seen = new Map<string, { section: string; lines: T[] }>();
  for (const line of lines.slice().sort((a, b) => a.position - b.position || a.id - b.id)) {
    const key = line.section.trim().toLowerCase();
    let s = seen.get(key);
    if (!s) {
      s = { section: line.section, lines: [] };
      seen.set(key, s);
      out.push(s);
    }
    s.lines.push(line);
  }
  return out;
}

const fold = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Does any of these words-of-text contain what was typed? */
export function textMatches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = fold(query);
  return !q || fields.some((f) => fold(f ?? "").includes(q));
}

/** The site a link goes to, for under its name: "kronos2.firescotland.local". */
export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** A link that only opens on the service's own network (no dot, or a .local name). */
export function isInternal(url: string): boolean {
  const host = hostOf(url);
  return !!host && (!host.includes(".") || /\.(local|internal|lan)$/i.test(host));
}
