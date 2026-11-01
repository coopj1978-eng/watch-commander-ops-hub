-- Station references (Nov 2026): the five watch references from the City of
-- Glasgow station standards (Appendix A), plus the duties for all watches
-- (ref 0). The wording lives here, not in the code, and WCs/CCs can edit it;
-- which watch holds which reference comes from the 10-year planner rota in
-- frontend/lib/referenceRota.ts.
CREATE TABLE IF NOT EXISTS station_references (
  ref        INT PRIMARY KEY CHECK (ref BETWEEN 0 AND 5),
  title      TEXT NOT NULL,
  sections   JSONB NOT NULL DEFAULT '[]',   -- [{ "heading": "...", "items": ["...", ...] }]
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
