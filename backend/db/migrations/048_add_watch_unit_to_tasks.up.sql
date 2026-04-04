-- Add watch_unit so tasks belong to a watch, not just a person
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS watch_unit TEXT;

-- Backfill: try assigned_to user's watch first, fall back to assigned_by user's watch
UPDATE tasks t
SET watch_unit = COALESCE(
  (SELECT u.watch_unit FROM users u WHERE u.id = t.assigned_to_user_id AND u.watch_unit IS NOT NULL AND u.watch_unit != ''),
  (SELECT u.watch_unit FROM users u WHERE u.id = t.assigned_by     AND u.watch_unit IS NOT NULL AND u.watch_unit != '')
)
WHERE t.watch_unit IS NULL;

-- Extend source_type to include station calendar events
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_source_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_source_type_check
  CHECK (source_type IS NULL OR source_type IN (
    'hfsv', 'hydrant', 'multistory', 'operational', 'care_home', 'station_event'
  ));

CREATE INDEX IF NOT EXISTS idx_tasks_watch_unit ON tasks (watch_unit);
