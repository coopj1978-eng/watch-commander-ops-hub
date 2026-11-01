-- Weekly routine (Nov 2026). A station's routine changes every day but
-- repeats each week (Monday: hydrants and pump test, Tuesday: ladders…), and
-- every shift has its own checks. The Routines planner keeps each of these as
-- one template per slot: 'every' (every shift) or a weekday + shift such as
-- 'MO-day' / 'MO-night'. Other templates (monthly, quarterly…) have no slot.
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS routine_slot TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS task_templates_routine_slot
  ON task_templates (routine_slot) WHERE routine_slot IS NOT NULL;

-- An "every shift" template can be limited to the day or the night shift.
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS shift_only TEXT;
ALTER TABLE task_templates DROP CONSTRAINT IF EXISTS task_templates_shift_only_check;
ALTER TABLE task_templates ADD CONSTRAINT task_templates_shift_only_check
  CHECK (shift_only IS NULL OR shift_only IN ('day', 'night'));
