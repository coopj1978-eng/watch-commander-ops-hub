CREATE TABLE IF NOT EXISTS notes (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES firefighter_profiles(id) ON DELETE CASCADE,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  next_follow_up_date DATE,
  reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_recipient_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  calendar_event_id BIGINT REFERENCES calendar_events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notes_profile_id ON notes(profile_id);
CREATE INDEX idx_notes_created_by_user_id ON notes(created_by_user_id);
CREATE INDEX idx_notes_reminder_recipient_user_id ON notes(reminder_recipient_user_id);
CREATE INDEX idx_notes_calendar_event_id ON notes(calendar_event_id);
CREATE INDEX idx_notes_next_follow_up_date ON notes(next_follow_up_date) WHERE reminder_enabled = TRUE;
