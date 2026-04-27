-- Sickness absences need an explicit "booked back fit" lifecycle event.
-- Until now, an absence ended when its end_date passed — silently and
-- automatically. In real WC practice the original end_date is just an
-- *expectation* ("she said three days"); if the FF doesn't actually
-- return, the WC has to keep her flagged as sick until they explicitly
-- book her back fit.
--
-- This column closes that gap:
--   • NULL  → absence is still open. The FF is treated as currently
--             off regardless of whether end_date has passed.
--   • Set   → the timestamp when the WC marked the FF back fit. Acts
--             as the effective close-out date for crew-on-watch /
--             dashboard / reporting purposes.
--
-- Backfill: existing rows with end_date already in the past get
-- returned_to_work_at = end_date so they don't suddenly all show as
-- "still off" after deploy. Future rows start NULL and require an
-- explicit back-fit action.
ALTER TABLE absences
  ADD COLUMN IF NOT EXISTS returned_to_work_at TIMESTAMPTZ;

UPDATE absences
   SET returned_to_work_at = (end_date::timestamp AT TIME ZONE 'UTC') + interval '1 day'
 WHERE returned_to_work_at IS NULL
   AND end_date < CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_absences_open_sickness
  ON absences (firefighter_id)
  WHERE returned_to_work_at IS NULL AND type = 'sickness' AND status = 'approved';
