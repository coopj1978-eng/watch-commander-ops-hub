import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";

interface DeleteNoteRequest {
  id: number;
}

interface DeleteNoteResponse {
  success: boolean;
}

export const deleteNote = api<DeleteNoteRequest, DeleteNoteResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/notes/:id" },
  async ({ id }) => {
    const auth = getAuthData()!;

    const existingNote = await db.queryRow<{
      id: number;
      created_by_user_id: string;
      calendar_event_id?: number;
    }>`
      SELECT id, created_by_user_id, calendar_event_id 
      FROM notes 
      WHERE id = ${id}
    `;

    if (!existingNote) {
      throw APIError.notFound("note not found");
    }

    if (existingNote.created_by_user_id !== auth.userID) {
      throw APIError.permissionDenied("only the note creator can delete it");
    }

    if (existingNote.calendar_event_id) {
      await db.exec`
        DELETE FROM calendar_events WHERE id = ${existingNote.calendar_event_id}
      `;
    }

    await db.exec`
      DELETE FROM notes WHERE id = ${id}
    `;

    await logActivity({
      user_id: auth.userID,
      action: "delete_note",
      entity_type: "note",
      entity_id: id.toString(),
      details: {},
    });

    return { success: true };
  }
);
