import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { ListNotesRequest, ListNotesResponse, Note } from "./types";

interface DBNote {
  id: number;
  profile_id: number;
  created_by_user_id: string;
  note_text: string;
  next_follow_up_date?: Date;
  reminder_enabled: boolean;
  reminder_recipient_user_id?: string;
  calendar_event_id?: number;
  attachments?: any;
  created_at: Date;
  updated_at: Date;
}

function transformNote(dbNote: DBNote): Note {
  return {
    ...dbNote,
    next_follow_up_date: dbNote.next_follow_up_date
      ? dbNote.next_follow_up_date.toISOString().split("T")[0]
      : undefined,
    attachments: dbNote.attachments || [],
  };
}

export const list = api<ListNotesRequest, ListNotesResponse>(
  { auth: true, expose: true, method: "GET", path: "/notes" },
  async (req) => {
    const auth = getAuthData()!;

    let dbNotes: DBNote[];

    if (req.profile_id) {
      const query = `
        SELECT * FROM notes 
        WHERE profile_id = $1
        AND (
          created_by_user_id = $2
          OR reminder_recipient_user_id = $2
        )
        ORDER BY created_at DESC
      `;
      dbNotes = await db.rawQueryAll<DBNote>(query, req.profile_id, auth.userID);
    } else if (req.user_id) {
      const query = `
        SELECT * FROM notes 
        WHERE created_by_user_id = $1
        OR reminder_recipient_user_id = $1
        ORDER BY created_at DESC
      `;
      dbNotes = await db.rawQueryAll<DBNote>(query, req.user_id);
    } else {
      const query = `
        SELECT * FROM notes 
        WHERE created_by_user_id = $1
        OR reminder_recipient_user_id = $1
        ORDER BY created_at DESC
      `;
      dbNotes = await db.rawQueryAll<DBNote>(query, auth.userID);
    }

    return {
      notes: dbNotes.map(transformNote),
    };
  }
);
