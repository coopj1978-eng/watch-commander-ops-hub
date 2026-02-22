-- Rename 'type' column to 'absence_type' to avoid SQL reserved word conflicts
-- Encore's SQL parser may transform 'type' → 'absence_type' in queries
ALTER TABLE absences RENAME COLUMN type TO absence_type;
