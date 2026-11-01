-- Hydrants that aren't fully functional are emailed away in a report (John,
-- Nov 2026). Marking them reported keeps the next report to new ones; a
-- result that changes afterwards counts as new again.
ALTER TABLE hydrant_inspections
  ADD COLUMN IF NOT EXISTS reported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reported_by_name TEXT;
