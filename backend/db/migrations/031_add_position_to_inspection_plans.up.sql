-- Add display-order position to all inspection plan tables
ALTER TABLE multistory_inspections ADD COLUMN position INT NOT NULL DEFAULT 0;
ALTER TABLE care_home_validations  ADD COLUMN position INT NOT NULL DEFAULT 0;
ALTER TABLE hydrant_registers      ADD COLUMN position INT NOT NULL DEFAULT 0;
ALTER TABLE operational_inspections ADD COLUMN position INT NOT NULL DEFAULT 0;

-- Initialise positions from existing insertion order
UPDATE multistory_inspections SET position = sub.pos
  FROM (SELECT id, (ROW_NUMBER() OVER (ORDER BY id) - 1) AS pos FROM multistory_inspections) sub
  WHERE multistory_inspections.id = sub.id;

UPDATE care_home_validations SET position = sub.pos
  FROM (SELECT id, (ROW_NUMBER() OVER (ORDER BY id) - 1) AS pos FROM care_home_validations) sub
  WHERE care_home_validations.id = sub.id;

UPDATE hydrant_registers SET position = sub.pos
  FROM (SELECT id, (ROW_NUMBER() OVER (ORDER BY id) - 1) AS pos FROM hydrant_registers) sub
  WHERE hydrant_registers.id = sub.id;

UPDATE operational_inspections SET position = sub.pos
  FROM (SELECT id, (ROW_NUMBER() OVER (ORDER BY id) - 1) AS pos FROM operational_inspections) sub
  WHERE operational_inspections.id = sub.id;
