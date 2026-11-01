-- Routine cards (Nov 2026, from John's Trello board): a day can have several
-- cards — "Monday weekly checks", "Monday monthly checks" (1st Monday) — each
-- with its own header. So a slot holds many templates, each with a rule for
-- which weeks it comes round and an optional header picture or colour.
DROP INDEX IF EXISTS task_templates_routine_slot;
CREATE INDEX IF NOT EXISTS task_templates_routine_slot_idx
  ON task_templates (routine_slot) WHERE routine_slot IS NOT NULL;

ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS routine_rule TEXT;
ALTER TABLE task_templates DROP CONSTRAINT IF EXISTS task_templates_routine_rule_check;
ALTER TABLE task_templates ADD CONSTRAINT task_templates_routine_rule_check
  CHECK (routine_rule IS NULL OR routine_rule IN ('weekly', 'first', 'last', 'quarter-last'));
-- NULL = the automatic header (day + how often); otherwise a colour id, an
-- image URL or an uploaded picture (data URL), copied onto each card.
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS cover TEXT;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS routine_position INT NOT NULL DEFAULT 0;
