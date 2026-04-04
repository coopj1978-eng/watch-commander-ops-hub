ALTER TABLE absences ADD COLUMN IF NOT EXISTS sick_line_document TEXT;
ALTER TABLE absences ADD COLUMN IF NOT EXISTS created_by_user_id TEXT REFERENCES users(id);
