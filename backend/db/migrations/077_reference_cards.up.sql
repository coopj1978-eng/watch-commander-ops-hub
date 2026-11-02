-- Reference duty cards (Nov 2026): each station reference has a monthly,
-- quarterly and annual card of checks, made for whichever watch holds the
-- reference (the 10-year planner) — or its secondary watch when the main
-- watch is on leave — and kept on that watch's board until done.
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS reference_no INT;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS reference_cadence TEXT;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS reference_month INT;
ALTER TABLE task_templates DROP CONSTRAINT IF EXISTS task_templates_reference_check;
ALTER TABLE task_templates ADD CONSTRAINT task_templates_reference_check CHECK (
  (reference_no IS NULL AND reference_cadence IS NULL)
  OR (reference_no BETWEEN 1 AND 5 AND reference_cadence IN ('monthly', 'quarterly', 'annual')
      AND (reference_month IS NULL OR reference_month BETWEEN 1 AND 12))
);
CREATE UNIQUE INDEX IF NOT EXISTS task_templates_reference_card
  ON task_templates (reference_no, reference_cadence) WHERE reference_no IS NOT NULL;
