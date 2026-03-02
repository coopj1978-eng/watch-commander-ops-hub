ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS calendar_visibility VARCHAR(20) NOT NULL DEFAULT 'station'
    CHECK (calendar_visibility IN ('station', 'watch', 'personal'));

-- Backfill existing data based on is_watch_event flag
UPDATE calendar_events
SET calendar_visibility = CASE
  WHEN is_watch_event = true THEN 'station'
  WHEN event_type = 'personal' THEN 'personal'
  ELSE 'station'
END;
