import { APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";

// Notes & 1:1s are a WC/CC tool and private to whoever wrote them: nobody
// else — not the person they're about, not another WC — can read them.

export function assertCanWriteNotes(): string {
  const auth = getAuthData()!;
  if (auth.role !== "WC" && auth.role !== "CC") {
    throw APIError.permissionDenied("Notes & 1:1s are for Watch Commanders and Crew Commanders.");
  }
  return auth.userID;
}

/** The note exists and the caller wrote it. Returns the caller's id. */
export async function assertNoteAuthor(noteId: number): Promise<string> {
  const auth = getAuthData()!;
  const note = await db.queryRow<{ created_by_user_id: string }>`
    SELECT created_by_user_id FROM notes WHERE id = ${noteId}
  `;
  if (!note) throw APIError.notFound("note not found");
  if (note.created_by_user_id !== auth.userID) {
    throw APIError.permissionDenied("Notes are private to the person who wrote them.");
  }
  return auth.userID;
}
