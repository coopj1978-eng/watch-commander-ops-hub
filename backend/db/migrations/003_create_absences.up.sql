CREATE TABLE absences (
  id BIGSERIAL PRIMARY KEY,
  firefighter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sickness', 'AL', 'TOIL', 'parental', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  docs TEXT[],
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by TEXT REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_absences_firefighter_id ON absences(firefighter_id);
CREATE INDEX idx_absences_type ON absences(type);
CREATE INDEX idx_absences_status ON absences(status);
CREATE INDEX idx_absences_start_date ON absences(start_date);
