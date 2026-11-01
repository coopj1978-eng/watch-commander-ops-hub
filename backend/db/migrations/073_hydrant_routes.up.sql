-- Hydrant routes (Nov 2026): every hydrant on the station's SP routes, loaded
-- from the route workbooks by an import (the list stays out of the code), and
-- each year's inspection of it. Which watch has a route in a year comes from
-- the rota in backend/lib/hydrantRota.ts.
CREATE TABLE IF NOT EXISTS hydrants (
  id         SERIAL PRIMARY KEY,
  route      TEXT NOT NULL,            -- '27', '28A', '3A+AA'
  seq        INT  NOT NULL,            -- HYD NO on the route sheet
  ref        TEXT,                     -- ID NO (Scottish Water), e.g. '3919'
  street     TEXT NOT NULL,
  location   TEXT,
  main_size  TEXT,
  surface    TEXT,                     -- ROAD / PAV / GV
  marker     TEXT,                     -- PLATE / POST
  dist       TEXT,
  in_use     BOOLEAN NOT NULL DEFAULT true,   -- false = abandoned / removed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (route, seq)
);

CREATE TABLE IF NOT EXISTS hydrant_inspections (
  id                SERIAL PRIMARY KEY,
  hydrant_id        INT  NOT NULL REFERENCES hydrants(id) ON DELETE CASCADE,
  year              INT  NOT NULL,
  watch             TEXT NOT NULL,
  lid_ok            BOOLEAN,           -- cover and lid secured and level
  trip_hazard       BOOLEAN,
  inspection_codes  JSONB NOT NULL DEFAULT '[1]',  -- e.g. [1] or [7, 12]
  action_codes      JSONB NOT NULL DEFAULT '[1]',
  comment           TEXT,
  inspected_by      TEXT NOT NULL,
  inspected_by_name TEXT,
  inspected_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hydrant_id, year)
);

CREATE INDEX IF NOT EXISTS hydrant_inspections_year ON hydrant_inspections (year, watch);
