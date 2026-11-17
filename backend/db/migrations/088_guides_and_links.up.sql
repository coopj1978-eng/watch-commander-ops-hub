-- How-to guides and the station's regular links (John, Nov 2026). Both lived
-- on Notion pages; here they're organised under headings, searchable and
-- edited by the admin. The wording and addresses are typed in through the
-- app — none are in this repository.
CREATE TABLE IF NOT EXISTS station_links (
  id          SERIAL PRIMARY KEY,
  section     TEXT NOT NULL,              -- the heading it sits under ("Systems")
  title       TEXT NOT NULL,              -- what it's called ("Kronos")
  url         TEXT NOT NULL,              -- http(s) only
  note        TEXT,                       -- "Station computers only"
  position    INTEGER NOT NULL DEFAULT 0,
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_station_links_position ON station_links(position, id);

CREATE TABLE IF NOT EXISTS guides (
  id          SERIAL PRIMARY KEY,
  section     TEXT NOT NULL,              -- "Defects and equipment"
  title       TEXT NOT NULL,              -- "Raising a station defect"
  summary     TEXT,                       -- one line under the title
  body        TEXT NOT NULL DEFAULT '',   -- the steps, in the guide markup (lib/guideMarkup.ts)
  position    INTEGER NOT NULL DEFAULT 0,
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_guides_position ON guides(position, id);
