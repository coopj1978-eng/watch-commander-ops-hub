-- Add reminder_date column
ALTER TABLE skill_renewals ADD COLUMN IF NOT EXISTS reminder_date DATE;

-- Create index on reminder_date for querying upcoming reminders
CREATE INDEX IF NOT EXISTS idx_skill_renewals_reminder_date ON skill_renewals(reminder_date);
