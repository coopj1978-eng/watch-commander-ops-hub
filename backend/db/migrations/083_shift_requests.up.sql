-- Flexi Day and Head for Head requests (Nov 2026): the person asks, the WC
-- reviews, the result comes back from Kronos. A request is a permanent
-- record: names and numbers are copied in so it still reads correctly if
-- someone later moves watch or leaves, and nothing here is ever deleted.

ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS flexi_limit_per_year INT NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS flexi_days_ahead     INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS flexi_notice_hours   INT NOT NULL DEFAULT 48;

CREATE TABLE IF NOT EXISTS shift_requests (
  id              BIGSERIAL PRIMARY KEY,
  type            TEXT NOT NULL CHECK (type IN ('flexi', 'h4h')),
  status          TEXT NOT NULL CHECK (status IN (
                    'with_cover', 'cover_declined', 'with_wc', 'authorised', 'referred',
                    'declined', 'approved', 'not_approved', 'withdrawn', 'cancelled')),

  -- The person asking
  user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_name       TEXT NOT NULL,
  user_role       TEXT NOT NULL,
  payroll_number  TEXT,
  station         TEXT,
  watch           TEXT NOT NULL,
  shift_date      DATE NOT NULL,
  shift_type      TEXT NOT NULL,
  day_night       TEXT NOT NULL CHECK (day_night IN ('Day', 'Night')),
  notes           TEXT,
  -- A WC's own request goes to another WC they choose
  reviewer_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewer_name    TEXT,

  -- Head for Head: the person working it
  cover_user_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  cover_name      TEXT,
  cover_payroll   TEXT,
  cover_station   TEXT,
  cover_watch     TEXT,
  cover_confirmed_at      TIMESTAMPTZ,
  cover_confirmed_by_name TEXT,

  -- Payback: a Head for Head's return shift, or the flexi payback from Kronos
  payback_date      DATE,
  payback_day_night TEXT CHECK (payback_day_night IN ('Day', 'Night')),
  payback_watch     TEXT,
  payback_status    TEXT CHECK (payback_status IN ('with_wc', 'authorised')),
  payback_signed_by_name TEXT,
  payback_signed_at TIMESTAMPTZ,

  -- The WC's decision, and what the checks said when they made it
  decided_by_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  decided_by_name TEXT,
  decided_by_role TEXT,
  decided_at      TIMESTAMPTZ,
  wc_comments     TEXT,
  pinch_point     TEXT CHECK (pinch_point IN ('green', 'white', 'red')),
  over_limit_agreed BOOLEAN NOT NULL DEFAULT FALSE,
  sc_endorsed     BOOLEAN NOT NULL DEFAULT FALSE,
  checks          JSONB,

  -- The result from Kronos / Central Staffing
  outcome_at      TIMESTAMPTZ,
  outcome_by_name TEXT,
  outcome_note    TEXT,
  shift_adjustment_id   BIGINT REFERENCES shift_adjustments(id) ON DELETE SET NULL,
  payback_adjustment_id BIGINT REFERENCES shift_adjustments(id) ON DELETE SET NULL,

  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_by_name TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_requests_user ON shift_requests (user_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_shift_requests_cover ON shift_requests (cover_user_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_shift_requests_status ON shift_requests (status);
CREATE INDEX IF NOT EXISTS idx_shift_requests_adjustment ON shift_requests (shift_adjustment_id);
-- One live request per person, type and date.
CREATE UNIQUE INDEX IF NOT EXISTS uq_shift_requests_live ON shift_requests (user_id, type, shift_date)
  WHERE status IN ('with_cover', 'with_wc', 'authorised', 'referred', 'approved');

-- The dated timeline on the record: added to, never edited.
CREATE TABLE IF NOT EXISTS shift_request_events (
  id          BIGSERIAL PRIMARY KEY,
  request_id  BIGINT NOT NULL REFERENCES shift_requests(id) ON DELETE CASCADE,
  at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  by_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  by_name     TEXT NOT NULL,
  action      TEXT NOT NULL,
  detail      TEXT
);
CREATE INDEX IF NOT EXISTS idx_shift_request_events_request ON shift_request_events (request_id, at);

-- Flexi days used before the app started keeping count.
CREATE TABLE IF NOT EXISTS flexi_opening_balances (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year     INT NOT NULL,
  used     INT NOT NULL CHECK (used >= 0),
  set_by   TEXT NOT NULL,
  set_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, year)
);
