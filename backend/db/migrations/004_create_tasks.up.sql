CREATE TABLE tasks (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('Training', 'Inspection', 'HFSV', 'Admin', 'Other')),
  assigned_to_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  assigned_by TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'NotStarted' CHECK (status IN ('NotStarted', 'InProgress', 'Blocked', 'Done')),
  priority TEXT NOT NULL DEFAULT 'Med' CHECK (priority IN ('Low', 'Med', 'High')),
  due_at TIMESTAMPTZ,
  checklist JSONB,
  attachments TEXT[],
  tags TEXT[],
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to_user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_category ON tasks(category);
CREATE INDEX idx_tasks_due_at ON tasks(due_at);
