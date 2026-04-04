CREATE TABLE handovers (
  id BIGSERIAL PRIMARY KEY,
  watch TEXT NOT NULL,
  shift_type TEXT NOT NULL DEFAULT 'Day' CHECK (shift_type IN ('Day', 'Night')),
  shift_date DATE NOT NULL,
  written_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  incidents TEXT,
  outstanding_tasks TEXT,
  equipment_notes TEXT,
  staff_notes TEXT,
  general_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_handovers_watch ON handovers(watch);
CREATE INDEX idx_handovers_shift_date ON handovers(shift_date DESC);
CREATE INDEX idx_handovers_written_by ON handovers(written_by_user_id);
