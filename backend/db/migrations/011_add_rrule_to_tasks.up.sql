ALTER TABLE tasks ADD COLUMN rrule TEXT;

CREATE INDEX idx_tasks_rrule ON tasks(rrule) WHERE rrule IS NOT NULL;
