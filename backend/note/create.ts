import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { canEditProfiles } from "../auth/rbac";
import type { CreateNoteRequest, ProfileNote } from "./types";

export const create = api(
  { auth: true, expose: true, method: "POST", path: "/notes" },
  async (req: CreateNoteRequest): Promise<ProfileNote> => {
    const auth = getAuthData()!;

    if (!canEditProfiles(auth)) {
      throw APIError.permissionDenied("Only WC and CC can create notes");
    }

    const note = await db.queryRow<ProfileNote>`
      INSERT INTO profile_notes (
        profile_id,
        author_user_id,
        note_text,
        next_follow_up_date,
        reminder_enabled
      ) VALUES (
        ${req.profile_id},
        ${auth.userID},
        ${req.note_text},
        ${req.next_follow_up_date || null},
        ${req.reminder_enabled || false}
      )
      RETURNING *
    `;

    if (!note) {
      throw APIError.internal("Failed to create note");
    }

    if (req.reminder_enabled && req.next_follow_up_date) {
      try {
        const profile = await db.queryRow<{ user_id: string }>`
          SELECT user_id FROM firefighter_profiles WHERE id = ${req.profile_id}
        `;
        
        if (profile) {
          await db.exec`
            INSERT INTO notifications (
              user_id,
              type,
              title,
              message,
              due_date,
              related_entity_type,
              related_entity_id
            ) VALUES (
              ${auth.userID},
              'follow_up',
              'Follow-up Reminder',
              ${`Follow up with regarding: ${req.note_text.substring(0, 100)}...`},
              ${req.next_follow_up_date},
              'profile_note',
              ${note.id.toString()}
            )
          `;
        }
      } catch (error) {
        console.error("Failed to create reminder notification:", error);
      }
    }

    return note;
  }
);
