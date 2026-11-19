import { api, APIError } from "encore.dev/api";
import db from "../db";
import { assertNoteAuthor } from "./access";
import { removeNoteFiles } from "./files";
import type { NoteAttachment } from "./types";

interface RemoveFileRequest {
  note_id: number;
  /** The file's key, as listed on the note. */
  key: string;
}

/**
 * Takes one file off a note (writer only). A note can hold many files, so
 * each can come off on its own without deleting the note.
 */
export const removeFile = api<RemoveFileRequest, { success: boolean }>(
  { auth: true, expose: true, method: "POST", path: "/notes/:note_id/files/remove" },
  async ({ note_id, key }) => {
    await assertNoteAuthor(note_id);

    const row = await db.queryRow<{ attachments: unknown }>`
      SELECT attachments FROM notes WHERE id = ${note_id}
    `;
    const raw = typeof row?.attachments === "string" ? JSON.parse(row.attachments) : row?.attachments;
    // A file saved by the first version of the upload went in as a JSON string.
    const files: NoteAttachment[] = (Array.isArray(raw) ? raw : []).map((a) =>
      typeof a === "string" ? JSON.parse(a) : a
    );

    const gone = files.filter((a) => a.key === key);
    if (gone.length === 0) throw APIError.notFound("That file isn't on this note.");
    const kept = files.filter((a) => a.key !== key);

    await db.exec`
      UPDATE notes SET attachments = ${JSON.stringify(kept)}::text::jsonb WHERE id = ${note_id}
    `;
    await removeNoteFiles(gone);
    return { success: true };
  }
);
