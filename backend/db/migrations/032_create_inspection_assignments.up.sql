CREATE TABLE inspection_assignments (
  id           BIGSERIAL PRIMARY KEY,
  plan_type    TEXT NOT NULL CHECK (plan_type IN ('multistory', 'care_home', 'hydrant', 'operational')),
  plan_id      INTEGER NOT NULL,
  label        TEXT NOT NULL,
  watch        TEXT NOT NULL,
  year         INTEGER NOT NULL,
  quarter      INTEGER CHECK (quarter IS NULL OR (quarter BETWEEN 1 AND 4)),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'complete')),
  completed_at TIMESTAMPTZ,
  completed_by INTEGER,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Idempotent re-generation: same plan + watch + year + quarter = same row
CREATE UNIQUE INDEX uq_inspection_assignment
  ON inspection_assignments(plan_type, plan_id, watch, year, COALESCE(quarter, 0));

CREATE INDEX idx_ia_watch_year ON inspection_assignments(watch, year);
CREATE INDEX idx_ia_status     ON inspection_assignments(status);
CREATE INDEX idx_ia_plan_type  ON inspection_assignments(plan_type);
