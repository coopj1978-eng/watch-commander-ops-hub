-- The J4 folder lists each appliance's kit by locker and shelf (John, Nov
-- 2026), so the J4 check follows the same order: where an item is kept, and
-- its place in the list. The kit itself is typed in through the app — none
-- of it is in this repository.
ALTER TABLE equipment_items ADD COLUMN IF NOT EXISTS locker TEXT;
ALTER TABLE equipment_items ADD COLUMN IF NOT EXISTS shelf TEXT;
ALTER TABLE equipment_items ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
