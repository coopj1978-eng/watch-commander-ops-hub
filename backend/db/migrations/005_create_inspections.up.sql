CREATE TABLE inspections (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('HighRise', 'LocalProperty', 'Hydrant', 'Other')),
  address TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  assigned_crew_ids TEXT[],
  status TEXT NOT NULL DEFAULT 'Planned' CHECK (status IN ('Planned', 'InProgress', 'Complete')),
  notes TEXT,
  completed_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inspections_type ON inspections(type);
CREATE INDEX idx_inspections_status ON inspections(status);
CREATE INDEX idx_inspections_scheduled_for ON inspections(scheduled_for);
CREATE INDEX idx_inspections_priority ON inspections(priority);
