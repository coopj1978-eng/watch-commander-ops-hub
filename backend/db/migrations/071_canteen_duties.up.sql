-- Canteen duty (John, Nov 2026): each shift a watch has one or two people on
-- canteen. They still ride — it's an extra duty, so it lives beside the
-- crewing board rather than in it. Kept per shift (days and nights) and
-- feeds a fairness rota like detachments: longest since canteen goes next.
CREATE TABLE IF NOT EXISTS canteen_duties (
  id          BIGSERIAL PRIMARY KEY,
  watch       TEXT NOT NULL,
  shift_date  DATE NOT NULL,
  shift_type  TEXT NOT NULL,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS canteen_duties_shift_person
  ON canteen_duties (LOWER(watch), shift_date, shift_type, user_id);

CREATE INDEX IF NOT EXISTS canteen_duties_person_date
  ON canteen_duties (user_id, shift_date DESC);
