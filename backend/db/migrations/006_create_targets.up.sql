CREATE TABLE targets (
  id BIGSERIAL PRIMARY KEY,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  metric TEXT NOT NULL CHECK (metric IN ('HFSV', 'HighRise', 'Hydrants', 'Activities')),
  target_count INTEGER NOT NULL,
  actual_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'at_risk', 'overdue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_targets_metric ON targets(metric);
CREATE INDEX idx_targets_status ON targets(status);
CREATE INDEX idx_targets_period_start ON targets(period_start);
CREATE INDEX idx_targets_period_end ON targets(period_end);
