-- "All watches" duty cards (Nov 2026): reference 0 (the duties for all
-- watches) can have monthly, quarterly and annual cards too, which go on
-- every watch's board on its own last tour of the period — first, the
-- quarterly targets report to the Station Commander.
ALTER TABLE task_templates DROP CONSTRAINT IF EXISTS task_templates_reference_check;
ALTER TABLE task_templates ADD CONSTRAINT task_templates_reference_check CHECK (
  (reference_no IS NULL AND reference_cadence IS NULL)
  OR (reference_no BETWEEN 0 AND 5 AND reference_cadence IN ('monthly', 'quarterly', 'annual')
      AND (reference_month IS NULL OR reference_month BETWEEN 1 AND 12))
);
