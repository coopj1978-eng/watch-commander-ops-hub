-- Add job_number column to toil_ledger for incident/job reference tracking
ALTER TABLE toil_ledger ADD COLUMN IF NOT EXISTS job_number TEXT;
