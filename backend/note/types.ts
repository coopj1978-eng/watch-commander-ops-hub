export interface Note {
  id: number;
  profile_id: number;
  created_by_user_id: string;
  note_text: string;
  next_follow_up_date?: string;
  reminder_enabled: boolean;
  reminder_recipient_user_id?: string;
  calendar_event_id?: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateNoteRequest {
  profile_id: number;
  note_text: string;
  next_follow_up_date?: string;
  reminder_enabled?: boolean;
  reminder_recipient_user_id?: string;
}

export interface UpdateNoteRequest {
  note_text?: string;
  next_follow_up_date?: string;
  reminder_enabled?: boolean;
  reminder_recipient_user_id?: string;
}

export interface ListNotesRequest {
  profile_id?: number;
  user_id?: string;
}

export interface ListNotesResponse {
  notes: Note[];
}
