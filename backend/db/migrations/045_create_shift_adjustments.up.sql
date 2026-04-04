CREATE TABLE IF NOT EXISTS shift_adjustments (
  id               BIGSERIAL PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id),
  type             TEXT NOT NULL CHECK (type IN ('flexi', 'training', 'h4h')),
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  covering_user_id TEXT REFERENCES users(id),
  covering_name    TEXT,
  watch_unit       TEXT NOT NULL,
  notes            TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_adj_watch_date ON shift_adjustments (watch_unit, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_shift_adj_user_date  ON shift_adjustments (user_id, start_date, end_date);
