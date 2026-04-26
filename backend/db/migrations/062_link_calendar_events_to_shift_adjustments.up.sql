-- Link calendar events to the shift_adjustment that created them so the
-- relationship is explicit and we can cascade lifecycle from either side.
--
-- Until now, calendar_events created by a shift adjustment (TOIL / H4H /
-- Flexi / Orange Day / Flexi Payback) carried no back-reference. Two
-- consequences:
--   • The /calendar event-delete UI had no way to know it was tied to a
--     shift_adjustment, so deleting the visible event left the underlying
--     adjustment + TOIL spent ledger row in place — confusing UX where
--     the calendar appears empty but balances + Shift Adjustments tab
--     still show it.
--   • The reverse cascade (delete adjustment → cleanup events) had to
--     match by user_id + date range + all_day, which is brittle.
--
-- New column lets both sides resolve the link in one step. ON DELETE
-- SET NULL so legacy events (created before this migration, FK is NULL)
-- stay intact, and so shift_adjustment delete via the application layer
-- still controls the cleanup ordering — we don't want the DB to silently
-- drop the events out from under us.
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS shift_adjustment_id BIGINT
    REFERENCES shift_adjustments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_shift_adjustment_id
  ON calendar_events (shift_adjustment_id);
