-- Expand equipment_defects to cover three defect types that the service
-- actually sees day-to-day:
--
--   - 'equipment' : a specific equipment item on an appliance (the existing
--                   flow — e.g. a BA set with a low-pressure warning).
--   - 'appliance' : the appliance itself (engine warning light, hydraulic
--                   leak, dash fault) — no specific equipment item.
--   - 'station'   : station infrastructure (bay door, boiler, office tap).
--
-- Prior to this migration every row required both equipment_item_id and
-- appliance_id (NOT NULL), which meant appliance-level and station-level
-- issues could not be captured in the system. Both FKs are now nullable and
-- a CHECK enforces the right combination for each defect_type.
--
-- Also adds:
--   - title    : short summary ("Engine warning light") shown in lists.
--   - location : free-text for station defects ("Appliance Bay 2").
-- These are optional for existing rows.

ALTER TABLE equipment_defects
  ALTER COLUMN equipment_item_id DROP NOT NULL,
  ALTER COLUMN appliance_id      DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS defect_type TEXT NOT NULL DEFAULT 'equipment'
    CHECK (defect_type IN ('equipment', 'appliance', 'station')),
  ADD COLUMN IF NOT EXISTS title    TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT;

-- Integrity: each defect_type needs the right FKs set.
ALTER TABLE equipment_defects DROP CONSTRAINT IF EXISTS equipment_defects_shape_check;
ALTER TABLE equipment_defects ADD CONSTRAINT equipment_defects_shape_check CHECK (
  (defect_type = 'equipment' AND equipment_item_id IS NOT NULL AND appliance_id IS NOT NULL) OR
  (defect_type = 'appliance' AND equipment_item_id IS NULL     AND appliance_id IS NOT NULL) OR
  (defect_type = 'station'   AND equipment_item_id IS NULL     AND appliance_id IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_defects_type ON equipment_defects(defect_type);
