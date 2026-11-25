-- A person's own days on top of their watch's rota (John, 25 Nov 2026): the
-- yearly schedule gives everyone "orange" days (a rest day they might be
-- called in on) and "purple" shifts (on shift, but may be sent elsewhere or
-- not needed), plus the odd course or moved leave day. One row per person
-- per day; everything else about their year is the watch's rota.
--
-- An orange day is faint until it's confirmed. Confirming it makes an
-- ordinary Orange Day booking (shift_adjustments), so the riding count, the
-- crewing board and "My next shifts" all pick it up; deleting that booking
-- puts the day back to "might be called in".
CREATE TABLE IF NOT EXISTS roster_days (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day                 DATE NOT NULL,
  kind                TEXT NOT NULL CHECK (kind IN ('orange', 'purple', 'training', 'leave', 'work', 'payback')),
  day_night           TEXT CHECK (day_night IN ('Day', 'Night')),
  code                TEXT,                         -- the schedule's own code (OPD, IPN, TC…), when it came from one
  source              TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('import', 'manual')),
  shift_adjustment_id BIGINT REFERENCES shift_adjustments(id) ON DELETE SET NULL,
  created_by          TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, day)
);

CREATE INDEX IF NOT EXISTS idx_roster_days_day ON roster_days(day);
