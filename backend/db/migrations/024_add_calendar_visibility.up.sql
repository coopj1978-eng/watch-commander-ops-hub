ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS visible_to_user_ids TEXT[];

CREATE INDEX IF NOT EXISTS idx_calendar_events_visible_to ON calendar_events USING GIN(visible_to_user_ids);
