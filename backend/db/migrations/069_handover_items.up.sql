-- Handover items (Oct 2026). A handover is a short list of notes for the
-- watch coming on:
--   action — something to do (kitbag to another station, a call to make):
--            becomes a station card on the shift board and stays for
--            whoever is on duty until someone does it;
--   info   — something to know (an incident, a road closure): shown to the
--            next watch until they mark the handover read, or to every watch
--            until show_until.

-- The watch on the shift after this one (from the rota) — who it's for.
ALTER TABLE handovers ADD COLUMN IF NOT EXISTS next_watch TEXT;

CREATE TABLE IF NOT EXISTS handover_items (
  id BIGSERIAL PRIMARY KEY,
  handover_id BIGINT NOT NULL REFERENCES handovers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('action', 'info')),
  tag TEXT,
  text TEXT NOT NULL,
  show_until DATE,
  task_id INT REFERENCES tasks(id) ON DELETE SET NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_handover_items_handover ON handover_items (handover_id);
CREATE INDEX IF NOT EXISTS idx_handover_items_task ON handover_items (task_id);

CREATE TABLE IF NOT EXISTS handover_reads (
  handover_id BIGINT NOT NULL REFERENCES handovers(id) ON DELETE CASCADE,
  watch TEXT NOT NULL,
  read_by TEXT NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (handover_id, watch)
);

-- Handover actions are station cards on the shift board.
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_source_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_source_type_check
  CHECK (source_type IS NULL OR source_type IN (
    'hfsv', 'hydrant', 'multistory', 'operational', 'care_home', 'station_event', 'template', 'handover'
  ));
