import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { CreateNoteRequest, Note } from "./types";

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

export const create = api<CreateNoteRequest, Note>(
  { auth: true, expose: true, method: "POST", path: "/notes" },
  async (req) => {
    const auth = getAuthData()!;

    try {
      if (req.reminder_enabled && !req.next_follow_up_date) {
        throw APIError.invalidArgument(
          "next_follow_up_date is required when reminder is enabled"
        );
      }

      if (req.reminder_recipient_user_id) {
        const recipientExists = await db.queryRow<{ id: string }>`
          SELECT id FROM users WHERE id = ${req.reminder_recipient_user_id}
        `;
        if (!recipientExists) {
          throw APIError.invalidArgument("reminder recipient user not found");
        }
      }

      const profileExists = await db.queryRow<{ id: number }>`
        SELECT id FROM firefighter_profiles WHERE id = ${req.profile_id}
      `;
      if (!profileExists) {
        throw APIError.invalidArgument("profile not found");
      }

      let calendarEventId: number | undefined;

      if (req.reminder_enabled && req.next_follow_up_date) {
        const profile = await db.queryRow<{ user_id: string }>`
          SELECT user_id FROM firefighter_profiles WHERE id = ${req.profile_id}
        `;

        const profileUser = await db.queryRow<{ name: string }>`
          SELECT name FROM users WHERE id = ${profile!.user_id}
        `;

        const title = `Follow-up: ${profileUser!.name}`;
        const description = req.note_text.substring(0, 200);

        const startTime = new Date(req.next_follow_up_date);
        const endTime = new Date(req.next_follow_up_date);
        endTime.setHours(23, 59, 59);

        const calendarEvent = await db.queryRow<{ id: number }>`
          INSERT INTO calendar_events (
            title, description, start_time, end_time, 
            event_type, created_by, all_day
          )
          VALUES (
            ${title}, ${description}, ${startTime}, ${endTime},
            'reminder', ${auth.userID}, TRUE
          )
          RETURNING id
        `;

        calendarEventId = calendarEvent?.id;
      }

      const dbNote = await db.queryRow<DBNote>`
        INSERT INTO notes (
          profile_id, created_by_user_id, note_text, 
          next_follow_up_date, reminder_enabled, 
          reminder_recipient_user_id, calendar_event_id
        )
        VALUES (
          ${req.profile_id}, 
          ${auth.userID}, 
          ${req.note_text},
          ${req.next_follow_up_date ? new Date(req.next_follow_up_date) : null},
          ${req.reminder_enabled || false},
          ${req.reminder_recipient_user_id || null},
          ${calendarEventId || null}
        )
        RETURNING *
      `;

      if (!dbNote) {
        throw APIError.internal("failed to create note");
      }

      await logActivity({
        user_id: auth.userID,
        action: "create_note",
        entity_type: "note",
        entity_id: dbNote.id.toString(),
        details: { profile_id: req.profile_id },
      });

      return transformNote(dbNote);
    } catch (error) {
      console.error("Error creating note:", error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal(`failed to create note: ${error}`);
    }
  }
);
