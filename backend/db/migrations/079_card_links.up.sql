-- A link on a reference / all-watches card (Nov 2026), e.g. the shared
-- quarterly targets spreadsheet the SC report goes in. Read through the
-- template, so changing it updates cards already on the boards.
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS link_url TEXT;
