-- Overtime (John, Nov 2026): logged like the other extra shifts — a date, day
-- or night, the watch worked with — plus the hours, which are added up per
-- month for each person. Hours only; no pay rates or amounts are kept here.
ALTER TABLE shift_adjustments DROP CONSTRAINT IF EXISTS shift_adjustments_type_check;
ALTER TABLE shift_adjustments ADD CONSTRAINT shift_adjustments_type_check
  CHECK (type IN ('flexi', 'training', 'h4h', 'flexi_payback', 'orange_day', 'toil', 'overtime'));

ALTER TABLE shift_adjustments ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC(5,2);
