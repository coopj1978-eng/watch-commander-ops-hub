-- Shift board (Oct 2026). Repeating templates are STATION checks: their cards
-- belong to the station (no watch), so whichever watch is on duty sees them.
-- A check is made once per shift ("every shift") or once per day it fires.

-- "Every shift": a card for the day shift and one for the night shift of each
-- day the template's rrule fires on.
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS per_shift BOOLEAN NOT NULL DEFAULT false;

-- One card per template per shift ('day' / 'night') or per day ('').
ALTER TABLE task_template_instances ADD COLUMN IF NOT EXISTS generated_for_shift TEXT NOT NULL DEFAULT '';
ALTER TABLE task_template_instances DROP CONSTRAINT IF EXISTS task_template_instances_template_id_generated_for_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS task_template_instances_slot_key
  ON task_template_instances (template_id, generated_for_date, generated_for_shift);

-- Template cards are tagged so the board can show them as station checks.
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_source_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_source_type_check
  CHECK (source_type IS NULL OR source_type IN (
    'hfsv', 'hydrant', 'multistory', 'operational', 'care_home', 'station_event', 'template'
  ));
UPDATE tasks SET source_type = 'template'
WHERE source_type IS NULL AND id IN (SELECT task_id FROM task_template_instances);

-- Who ticked it off — the Done column shows it.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_by TEXT;

-- The old generator left a daily copy of each template on no board (no
-- watch); retire those. From now on the previous copy of a check is marked
-- Missed when the next one is made.
UPDATE tasks SET status = 'Missed', updated_at = NOW()
WHERE source_type = 'template' AND status NOT IN ('Done', 'Missed')
  AND created_at < NOW() - INTERVAL '20 hours';

CREATE INDEX IF NOT EXISTS idx_tasks_source_status ON tasks (source_type, status);
