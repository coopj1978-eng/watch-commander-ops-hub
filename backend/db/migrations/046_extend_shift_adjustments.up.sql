-- Extend type constraint to include new inbound cover types
ALTER TABLE shift_adjustments DROP CONSTRAINT IF EXISTS shift_adjustments_type_check;
ALTER TABLE shift_adjustments ADD CONSTRAINT shift_adjustments_type_check
  CHECK (type IN ('flexi', 'training', 'h4h', 'flexi_payback', 'orange_day'));

-- covering_watch: the watch being covered (for flexi_payback / orange_day)
-- shift_day_night: 'Day' or 'Night' — determines which shift rows to surface on crewing board
ALTER TABLE shift_adjustments ADD COLUMN IF NOT EXISTS covering_watch   TEXT;
ALTER TABLE shift_adjustments ADD COLUMN IF NOT EXISTS shift_day_night  TEXT CHECK (shift_day_night IN ('Day', 'Night'));

CREATE INDEX IF NOT EXISTS idx_shift_adj_covering ON shift_adjustments (covering_watch, start_date, end_date);
