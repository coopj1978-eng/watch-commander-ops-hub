-- Add missing columns that the application code expects
ALTER TABLE absences ADD COLUMN IF NOT EXISTS total_days INTEGER;
ALTER TABLE absences ADD COLUMN IF NOT EXISTS created_by_user_id TEXT REFERENCES users(id);
ALTER TABLE absences ADD COLUMN IF NOT EXISTS evidence_urls TEXT[];

-- Backfill total_days from date range for existing rows
UPDATE absences SET total_days = (end_date - start_date + 1) WHERE total_days IS NULL;

-- Copy docs to evidence_urls if docs has data
UPDATE absences SET evidence_urls = docs WHERE docs IS NOT NULL AND evidence_urls IS NULL;
