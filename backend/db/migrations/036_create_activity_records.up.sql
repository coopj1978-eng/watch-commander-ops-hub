-- Activity records: individual HFSV visits, hydrant inspections, and community
-- engagements per watch per financial-year quarter.
--
-- financial_year is the April-start year (e.g. 2025 = 2025/26).
-- quarter follows SFRS financial quarters: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar.

CREATE TABLE activity_records (
  id             BIGSERIAL PRIMARY KEY,
  type           TEXT        NOT NULL CHECK (type IN ('hfsv', 'hydrant', 'community')),
  watch          TEXT        NOT NULL,
  financial_year INTEGER     NOT NULL,
  quarter        INTEGER     NOT NULL CHECK (quarter BETWEEN 1 AND 4),

  -- HFSV: item_number 1-36; hydrant/community: NULL
  item_number    INTEGER,

  -- hydrant: street/area; community: engagement name; HFSV: address (optional)
  title          TEXT        NOT NULL DEFAULT '',

  -- optional supplementary address for hydrant/HFSV
  address        TEXT,

  -- community engagement only
  engagement_date DATE,
  details         TEXT,

  completed      BOOLEAN     NOT NULL DEFAULT FALSE,
  completed_at   TIMESTAMPTZ,
  sort_order     INTEGER     NOT NULL DEFAULT 0,
  created_by     TEXT        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_records_type_watch ON activity_records(type, watch);
CREATE INDEX idx_activity_records_year_quarter ON activity_records(financial_year, quarter);
