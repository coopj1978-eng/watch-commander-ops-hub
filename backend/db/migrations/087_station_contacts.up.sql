-- The station's regular phone numbers (John, Nov 2026): the lists that were
-- on the office whiteboard, in one page everyone can open. The numbers
-- themselves are typed in through the app — none are in this repository.
CREATE TABLE IF NOT EXISTS station_contacts (
  id          SERIAL PRIMARY KEY,
  section     TEXT NOT NULL,             -- the heading it sits under ("Control and staffing")
  name        TEXT NOT NULL,             -- who or what ("Control", "B01 Cowcaddens")
  detail      TEXT,                      -- what they're for ("Property manager")
  numbers     TEXT NOT NULL,             -- one or more, split with " / "
  note        TEXT,
  position    INTEGER NOT NULL DEFAULT 0, -- order on the page; a section sits where its first line does
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_station_contacts_position ON station_contacts(position, id);
