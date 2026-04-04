ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS watch       TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT CHECK (source_type IN ('hfsv','hydrant','multistory','operational','care_home')),
  ADD COLUMN IF NOT EXISTS source_id   BIGINT;
