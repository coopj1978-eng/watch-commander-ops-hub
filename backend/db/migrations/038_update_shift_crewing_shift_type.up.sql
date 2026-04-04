-- Migrate shift_type from 2-value ('Day'/'Night') to 4-value
-- ('1st Day' / '2nd Day' / '1st Night' / '2nd Night') to match
-- the actual 2-day / 2-night shift rotation pattern.

-- Carry existing dev data forward cleanly
UPDATE shift_crewing SET shift_type = '1st Day'   WHERE shift_type = 'Day';
UPDATE shift_crewing SET shift_type = '1st Night' WHERE shift_type = 'Night';

-- Replace the old CHECK constraint
ALTER TABLE shift_crewing
  DROP CONSTRAINT IF EXISTS shift_crewing_shift_type_check;

ALTER TABLE shift_crewing
  ADD CONSTRAINT shift_crewing_shift_type_check
  CHECK (shift_type IN ('1st Day', '2nd Day', '1st Night', '2nd Night'));

-- Also update the lookup index to remain useful
DROP INDEX IF EXISTS idx_shift_crewing_lookup;
CREATE INDEX idx_shift_crewing_lookup ON shift_crewing (watch, shift_date, shift_type);
