export interface ProfileNote {
  id: number;
  profile_id: number;
  author_user_id: string;
  note_text: string;
  created_at: Date;
  next_follow_up_date?: Date;
  reminder_enabled: boolean;
}

export interface CreateNoteRequest {
  profile_id: number;
  note_text: string;
  next_follow_up_date?: Date;
  reminder_enabled?: boolean;
}

export interface ListNotesResponse {
  notes: ProfileNote[];
}
