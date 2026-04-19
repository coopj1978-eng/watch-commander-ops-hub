-- Additional qualification flags used for crewing-board warnings.
-- All default to FALSE so existing rows stay backwards-compatible; the
-- crewing board simply surfaces amber warnings when an assigned member is
-- missing the qualification for their slot (or when no one on an appliance
-- has a required specialism like Mass Decon / Hooklift).
ALTER TABLE firefighter_profiles
ADD COLUMN IF NOT EXISTS oic BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS mass_decon BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS hooklift_operator BOOLEAN DEFAULT FALSE;
