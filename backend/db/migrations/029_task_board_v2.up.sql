-- Custom columns for the task board
CREATE TABLE task_columns (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  status_key TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6b7280',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the four default columns
INSERT INTO task_columns (name, status_key, color, position) VALUES
  ('Not Started', 'NotStarted', '#6b7280', 0),
  ('In Progress', 'InProgress', '#3b82f6', 1),
  ('Blocked',     'Blocked',    '#ef4444', 2),
  ('Done',        'Done',       '#22c55e', 3);

-- Within-column card ordering (float allows midpoint insertion without reindexing)
ALTER TABLE tasks ADD COLUMN position FLOAT NOT NULL DEFAULT 0;

-- Remove the hardcoded status constraint so custom column status_keys are valid
ALTER TABLE tasks DROP CONSTRAINT tasks_status_check;

-- Work template definitions (recurring, scheduled cards)
CREATE TABLE task_templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  title_template TEXT NOT NULL,
  task_description TEXT,
  category TEXT NOT NULL DEFAULT 'Other',
  priority TEXT NOT NULL DEFAULT 'Med',
  checklist JSONB,
  rrule TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tracks which tasks were auto-generated from templates (prevents duplicates)
CREATE TABLE task_template_instances (
  id SERIAL PRIMARY KEY,
  template_id INT NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
  task_id INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  generated_for_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(template_id, generated_for_date)
);

CREATE INDEX idx_task_templates_active ON task_templates(is_active) WHERE is_active = true;
CREATE INDEX idx_task_columns_position ON task_columns(position);
