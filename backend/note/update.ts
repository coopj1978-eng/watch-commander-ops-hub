import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { UpdateNoteRequest, Note } from "./types";

interface UpdateNoteParams {
  id: number;
}

interface DBNote {
  id: number;
  profile_id: number;
  created_by_user_id: string;
  note_text: string;
  next_follow_up_date?: Date;
  reminder_enabled: boolean;
  reminder_recipient_user_id?: string;
  calendar_event_id?: number;
  created_at: Date;
  updated_at: Date;
}

function transformNote(dbNote: DBNote): Note {
  return {
    ...dbNote,
    next_follow_up_date: dbNote.next_follow_up_date
      ? dbNote.next_follow_up_date.toISOString().split("T")[0]
      : undefined,
  };
}

export const update = api(
  { auth: true, expose: true, method: "PATCH", path: "/notes/:id" },
  async (params: UpdateNoteParams & UpdateNoteRequest): Promise<Note> => {
    const { id, ...updates } = params;
    const auth = getAuthData()!;

    const existingNote = await db.queryRow<DBNote>`
      SELECT * FROM notes WHERE id = ${id}
    `;

    if (!existingNote) {
      throw APIError.notFound("note not found");
    }

    if (existingNote.created_by_user_id !== auth.userID) {
      throw APIError.permissionDenied("only the note creator can update it");
    }

    if (updates.reminder_recipient_user_id) {
      const recipientExists = await db.queryRow<{ id: string }>`
        SELECT id FROM users WHERE id = ${updates.reminder_recipient_user_id}
      `;
      if (!recipientExists) {
        throw APIError.invalidArgument("reminder recipient user not found");
      }
    }

    const setClauses: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (updates.note_text !== undefined) {
      setClauses.push(`note_text = $${paramIndex++}`);
      queryParams.push(updates.note_text);
    }

    if (updates.next_follow_up_date !== undefined) {
      setClauses.push(`next_follow_up_date = $${paramIndex++}`);
      queryParams.push(updates.next_follow_up_date ? new Date(updates.next_follow_up_date) : null);
    }

    if (updates.reminder_enabled !== undefined) {
      setClauses.push(`reminder_enabled = $${paramIndex++}`);
      queryParams.push(updates.reminder_enabled);
    }

    if (updates.reminder_recipient_user_id !== undefined) {
      setClauses.push(`reminder_recipient_user_id = $${paramIndex++}`);
      queryParams.push(updates.reminder_recipient_user_id || null);
    }

    if (setClauses.length === 0) {
      return transformNote(existingNote);
    }

    setClauses.push(`updated_at = NOW()`);
    queryParams.push(id);

    const query = `
      UPDATE notes
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const dbNote = await db.rawQueryRow<DBNote>(query, ...queryParams);

    if (!dbNote) {
      throw APIError.internal("failed to update note");
    }

    const shouldHaveCalendar = dbNote.reminder_enabled && dbNote.next_follow_up_date;

    if (shouldHaveCalendar) {
      const profile = await db.queryRow<{ user_id: string }>`
        SELECT user_id FROM firefighter_profiles WHERE id = ${dbNote.profile_id}
      `;

      const profileUser = await db.queryRow<{ name: string }>`
        SELECT name FROM users WHERE id = ${profile!.user_id}
      `;

      const title = `Follow-up: ${profileUser!.name}`;
      const description = dbNote.note_text.substring(0, 200);
      const startTime = new Date(dbNote.next_follow_up_date!);
      const endTime = new Date(dbNote.next_follow_up_date!);
      endTime.setHours(23, 59, 59);

      if (dbNote.calendar_event_id) {
        await db.exec`
          UPDATE calendar_events
          SET 
            title = ${title},
            description = ${description},
            start_time = ${startTime},
            end_time = ${endTime},
            updated_at = NOW()
          WHERE id = ${dbNote.calendar_event_id}
        `;
      } else {
        const calendarEvent = await db.queryRow<{ id: number }>`
          INSERT INTO calendar_events (
            title, description, start_time, end_time, 
            event_type, created_by, all_day
          )
          VALUES (
            ${title}, ${description}, 
            ${startTime}, 
            ${endTime},
            'reminder', ${auth.userID}, TRUE
          )
          RETURNING id
        `;

        if (calendarEvent) {
          await db.exec`
            UPDATE notes
            SET calendar_event_id = ${calendarEvent.id}
            WHERE id = ${id}
          `;
          dbNote.calendar_event_id = calendarEvent.id;
        }
      }
    } else if (dbNote.calendar_event_id) {
      await db.exec`
        DELETE FROM calendar_events WHERE id = ${dbNote.calendar_event_id}
      `;
      await db.exec`
        UPDATE notes SET calendar_event_id = NULL WHERE id = ${id}
      `;
      dbNote.calendar_event_id = undefined;
    }

    await logActivity({
      user_id: auth.userID,
      action: "update_note",
      entity_type: "note",
      entity_id: id.toString(),
      details: updates,
    });

    return transformNote(dbNote);
  }
);
