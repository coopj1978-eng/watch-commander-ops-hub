-- The office J4 board, in the app (John, Nov 2026). Each line on the board
-- has a J7 tick and the watch that put it up, so defects carry both.
ALTER TABLE equipment_defects
  ADD COLUMN IF NOT EXISTS j7_raised BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS watch TEXT;

-- Lines already there: the watch of whoever reported them.
UPDATE equipment_defects d
   SET watch = u.watch_unit
  FROM users u
 WHERE u.id = d.reported_by AND d.watch IS NULL AND u.watch_unit IS NOT NULL AND u.watch_unit <> '';
