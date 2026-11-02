import { noteAttachments } from "../storage";
import type { Note, NoteAttachment } from "./types";

// Note files live in a private bucket; the writer gets signed links that
// last an hour, made fresh each time their notes are listed.
const LINK_TTL_SECONDS = 60 * 60;

type Stored = NoteAttachment | string;

// A file saved by the first version of the upload (2 Nov 2026) went in as a
// JSON string rather than an object.
const parse = (a: Stored): NoteAttachment => (typeof a === "string" ? JSON.parse(a) : a);

export async function withFileLinks(note: Note): Promise<Note> {
  if (!note.attachments?.length) return note;
  const attachments = await Promise.all(
    (note.attachments as Stored[]).map(parse).map(async (a) =>
      a.key ? { ...a, url: (await noteAttachments.signedDownloadUrl(a.key, { ttl: LINK_TTL_SECONDS })).url } : a
    )
  );
  return { ...note, attachments };
}

/** Deletes a note's files (best effort: the note goes either way). */
export async function removeNoteFiles(attachments: Stored[] | null | undefined): Promise<void> {
  for (const a of (attachments ?? []).map(parse)) {
    if (!a.key) continue;
    try {
      await noteAttachments.remove(a.key);
    } catch (err) {
      console.error(`Couldn't remove note file ${a.key}:`, err);
    }
  }
}
