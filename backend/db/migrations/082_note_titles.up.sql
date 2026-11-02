-- Notes & 1:1s get an optional title (Nov 2026), so a WC can see at a glance
-- what each one was about without reading the whole note.
ALTER TABLE notes ADD COLUMN IF NOT EXISTS title TEXT;
