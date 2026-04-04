CREATE TABLE IF NOT EXISTS h4h_ledger (
  id                          BIGSERIAL PRIMARY KEY,
  creditor_user_id            TEXT NOT NULL REFERENCES users(id),
  creditor_name               TEXT NOT NULL,
  debtor_user_id              TEXT NOT NULL REFERENCES users(id),
  debtor_name                 TEXT NOT NULL,
  shift_date                  DATE NOT NULL,
  shift_adjustment_id         BIGINT REFERENCES shift_adjustments(id) ON DELETE SET NULL,
  payback_shift_adjustment_id BIGINT REFERENCES shift_adjustments(id) ON DELETE SET NULL,
  status                      TEXT NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'settled')),
  settled_at                  TIMESTAMPTZ,
  settled_by_user_id          TEXT REFERENCES users(id),
  settled_via                 TEXT CHECK (settled_via IN ('auto', 'manual')),
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_h4h_creditor ON h4h_ledger (creditor_user_id, status);
CREATE INDEX IF NOT EXISTS idx_h4h_debtor   ON h4h_ledger (debtor_user_id,   status);
