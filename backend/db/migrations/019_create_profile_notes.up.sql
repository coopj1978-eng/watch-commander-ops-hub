CREATE TABLE profile_notes (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES firefighter_profiles(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES users(id),
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_follow_up_date DATE,
  reminder_enabled BOOLEAN DEFAULT FALSE,
  CONSTRAINT check_note_text_not_empty CHECK (char_length(note_text) > 0)
);

CREATE INDEX idx_profile_notes_profile_id ON profile_notes(profile_id);
CREATE INDEX idx_profile_notes_author ON profile_notes(author_user_id);
CREATE INDEX idx_profile_notes_created_at ON profile_notes(created_at DESC);
CREATE INDEX idx_profile_notes_follow_up ON profile_notes(next_follow_up_date) WHERE next_follow_up_date IS NOT NULL;
