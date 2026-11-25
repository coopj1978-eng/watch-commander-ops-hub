// A tick line that opens a web page (John, 25 Nov 2026: "the tick part to be
// left tickable but the text to be linkable"). On a task and on the other
// scheduled checks the address lives on the line itself (`url`); the weekly
// routine planner keeps its lines as plain wording, so there the addresses
// sit beside them, keyed by the wording.

import { tidyUrl } from "./taskLinks";

/** Addresses by a line's wording (lower case, trimmed). */
export type LineLinks = Record<string, string>;

export const linkKey = (label: string) => label.trim().toLowerCase();

export function linkOf(links: LineLinks | undefined, label: string): string | undefined {
  return links?.[linkKey(label)];
}

/** Give a line an address, or take it away (null). */
export function setLineLink(links: LineLinks | undefined, label: string, url: string | null): LineLinks {
  const next = { ...(links ?? {}) };
  if (url) next[linkKey(label)] = url;
  else delete next[linkKey(label)];
  return next;
}

/** A line was reworded: its address follows the new wording. */
export function moveLineLink(links: LineLinks | undefined, from: string, to: string): LineLinks {
  const url = linkOf(links, from);
  const next = setLineLink(links, from, null);
  return url ? setLineLink(next, to, url) : next;
}

/** The addresses to send with a card: only for lines it still has. */
export function linksForSave(links: LineLinks | undefined, items: string[]): { label: string; url: string }[] {
  return items.flatMap((label) => {
    const url = linkOf(links, label);
    return url ? [{ label, url }] : [];
  });
}

export function linksFromChecklist(checklist: { label: string; url?: string }[] | undefined | null): LineLinks {
  const out: LineLinks = {};
  for (const i of checklist ?? []) if (i.url) out[linkKey(i.label)] = i.url;
  return out;
}

/**
 * What someone typed or pasted into a line's link box: a web address
 * ("https://" added if left off), nothing (take the link off), or not an
 * address at all.
 */
export function readTypedLink(input: string): { url: string } | { clear: true } | { bad: true } {
  const raw = input.trim();
  if (!raw) return { clear: true };
  const url = tidyUrl(raw);
  return url ? { url } : { bad: true };
}
