CREATE TABLE shift_crewing (
  id           BIGSERIAL PRIMARY KEY,
  watch        TEXT        NOT NULL,
  shift_date   DATE        NOT NULL,
  shift_type   TEXT        NOT NULL CHECK (shift_type IN ('Day', 'Night')),
  appliance    TEXT        NOT NULL CHECK (appliance IN ('b10p1', 'b10p2', 'detached')),

  -- Either a known user or a free-text external name (Change of Shift)
  user_id      TEXT        REFERENCES users(id) ON DELETE SET NULL,
  external_name TEXT,

  crew_role    TEXT        NOT NULL CHECK (crew_role IN ('oic', 'driver', 'ba', 'baeco', 'ff', 'detached')),
  is_change_of_shift BOOLEAN NOT NULL DEFAULT FALSE,
  notes        TEXT,

  created_by   TEXT        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT has_person CHECK (user_id IS NOT NULL OR external_name IS NOT NULL)
);

CREATE INDEX idx_shift_crewing_lookup ON shift_crewing (watch, shift_date, shift_type);
