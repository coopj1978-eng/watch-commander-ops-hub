-- Community engagement target: 6 per quarter, of which at least 3 must be
-- TAP-type engagements. Flag which engagements count as TAP.
ALTER TABLE activity_records ADD COLUMN IF NOT EXISTS is_tap BOOLEAN NOT NULL DEFAULT FALSE;
