-- TOIL (Time Off In Lieu) ledger
-- Tracks hours earned (pending WC/CC approval) and hours spent (via shift adjustments).
-- Financial year runs April–March (same as HFSV).

CREATE TABLE IF NOT EXISTS toil_ledger (
  id                    BIGSERIAL PRIMARY KEY,
  user_id               TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                  TEXT        NOT NULL CHECK (type IN ('earned', 'spent')),

  -- Hours (always positive; sign is determined by type)
  hours                 NUMERIC(5,2) NOT NULL CHECK (hours > 0),

  -- Earned entries need approval
  status                TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by_user_id   TEXT        REFERENCES users(id),
  approved_at           TIMESTAMPTZ,

  -- Context
  reason                TEXT,                      -- e.g. "Held up at incident – Maryhill Rd fire"
  shift_adjustment_id   BIGINT      REFERENCES shift_adjustments(id) ON DELETE SET NULL,
  incident_date         DATE,                      -- when the extra hours were worked
  financial_year        INTEGER     NOT NULL,       -- April-start year (e.g. 2025 = 2025/26)

  watch_unit            TEXT        NOT NULL,
  created_by            TEXT        NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_toil_user_year ON toil_ledger (user_id, financial_year);
CREATE INDEX IF NOT EXISTS idx_toil_status    ON toil_ledger (status, watch_unit);

-- Add 'toil' to the shift_adjustments type constraint
ALTER TABLE shift_adjustments DROP CONSTRAINT IF EXISTS shift_adjustments_type_check;
ALTER TABLE shift_adjustments ADD CONSTRAINT shift_adjustments_type_check
  CHECK (type IN ('flexi', 'training', 'h4h', 'flexi_payback', 'orange_day', 'toil'));

-- Add toil_hours column to shift_adjustments (how many TOIL hours being used for this shift)
ALTER TABLE shift_adjustments ADD COLUMN IF NOT EXISTS toil_hours NUMERIC(5,2);
