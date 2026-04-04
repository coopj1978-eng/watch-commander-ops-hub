ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS source_type TEXT CHECK (source_type IN ('hfsv','hydrant','multistory','operational','care_home')),
  ADD COLUMN IF NOT EXISTS source_id   BIGINT,
  ADD COLUMN IF NOT EXISTS calendar_event_id BIGINT;
