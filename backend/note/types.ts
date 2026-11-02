export interface NoteAttachment {
  filename: string;
  /** Where the file sits in the private note-attachments bucket. */
  key?: string;
  /** A short-lived signed link, made fresh each time the writer lists their notes. */
  url: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

export interface Note {
  id: number;
  profile_id: number;
  created_by_user_id: string;
  /** A short heading: what the note or 1:1 was about. */
  title?: string;
  note_text: string;
  next_follow_up_date?: string;
  reminder_enabled: boolean;
  reminder_recipient_user_id?: string;
  calendar_event_id?: number;
  attachments?: NoteAttachment[];
  created_at: Date;
  updated_at: Date;
}

export interface CreateNoteRequest {
  profile_id: number;
  title?: string;
  note_text: string;
  next_follow_up_date?: string;
  reminder_enabled?: boolean;
  reminder_recipient_user_id?: string;
}

export interface UpdateNoteRequest {
  /** An empty title clears it. */
  title?: string;
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
