-- Links on a routine card (John, Nov 2026): set once in the weekly routine
-- and on the card every time it comes round, like the links on any other
-- card. Stored as the task cards keep theirs: the address, or a name and the
-- address on two lines. A check's own wording can link somewhere too — that
-- address is kept on the check itself, in the checklist ("url").
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS links TEXT[] NOT NULL DEFAULT '{}';
