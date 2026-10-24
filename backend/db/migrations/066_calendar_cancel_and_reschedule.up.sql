-- Calendar events can be struck through (cancelled, with a reason) instead
-- of deleted, and a reschedule records where it moved from and why — like
-- putting a line through the paper calendar and writing a note.
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS cancelled_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by     TEXT,
  ADD COLUMN IF NOT EXISTS cancel_reason    TEXT,
  ADD COLUMN IF NOT EXISTS rescheduled_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS change_note      TEXT,
  ADD COLUMN IF NOT EXISTS changed_by       TEXT;
