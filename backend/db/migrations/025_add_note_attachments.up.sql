ALTER TABLE notes ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_notes_attachments ON notes USING GIN(attachments);
