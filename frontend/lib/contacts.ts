// Station contacts (Nov 2026): the office whiteboard's phone numbers.
// A line can carry several numbers ("3999 / 01505 000000"). A full number is
// a tap-to-call link; a short one is a desk extension and only shown.

export interface ContactLine {
  id: number;
  section: string;
  name: string;
  detail: string | null;
  numbers: string;
  note: string | null;
  position: number;
}

export interface NumberPart {
  text: string;
  /** What to dial, when it's a full number a mobile can call. */
  tel: string | null;
}

/** "3999 / 0141 000 0000" → the two numbers, the second one callable. */
export function splitNumbers(numbers: string): NumberPart[] {
  return numbers
    .split(/\s*[/,;]\s*/)
    .map((n) => n.trim())
    .filter(Boolean)
    .map((text) => {
      const digits = text.replace(/[^\d+]/g, "");
      const count = digits.replace(/\D/g, "").length;
      // UK numbers are 10 or 11 digits; anything shorter is an extension or a
      // local number with no code, which a mobile can't dial as it stands.
      return { text, tel: count >= 10 ? digits : null };
    });
}

export interface ContactSection {
  section: string;
  lines: ContactLine[];
}

const fold = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/** Does this line match what was typed? Names, headings and numbers all count; spaces don't. */
export function matches(line: ContactLine, query: string): boolean {
  const q = fold(query);
  if (!q) return true;
  return [line.name, line.detail ?? "", line.section, line.numbers, line.note ?? ""].some((f) => fold(f).includes(q));
}

/** The page: sections in the order their first line sits, lines in order within each. */
export function groupContacts(lines: ContactLine[], query = ""): ContactSection[] {
  const sorted = lines.slice().sort((a, b) => a.position - b.position || a.id - b.id);
  const sections: ContactSection[] = [];
  const byKey = new Map<string, ContactSection>();
  for (const line of sorted) {
    if (!matches(line, query)) continue;
    const key = line.section.trim().toLowerCase();
    let s = byKey.get(key);
    if (!s) {
      s = { section: line.section, lines: [] };
      byKey.set(key, s);
      sections.push(s);
    }
    s.lines.push(line);
  }
  return sections;
}

/** Headings already in use, in page order — offered when adding a line. */
export function sectionNames(lines: ContactLine[]): string[] {
  return groupContacts(lines).map((s) => s.section);
}
