-- Training records: two-phase workflow.
-- Phase 1 (planned): WC schedules a future training event with date, type, topic.
-- Phase 2 (completed): after training, WC logs duration, notes, and attendance.

CREATE TABLE IF NOT EXISTS training_records (
  id              BIGSERIAL PRIMARY KEY,
  watch           TEXT NOT NULL,
  training_date   DATE NOT NULL,
  shift_type      TEXT,                                     -- nullable: not always tied to a specific shift
  training_type   TEXT NOT NULL CHECK (training_type IN (
    'ba_drill', 'rtc', 'ladder', 'water', 'hazmat',
    'first_aid', 'driver', 'debrief', 'physical',
    'station_drill', 'lecture', 'assessment', 'other'
  )),
  topic           TEXT NOT NULL,                            -- e.g. "Pump to open water"
  duration_hours  NUMERIC(4,1),                             -- null while planned, set on completion
  notes           TEXT,                                     -- debrief / development points
  status          TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'cancelled')),
  created_by      TEXT NOT NULL,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_training_records_lookup ON training_records (watch, training_date, status);

CREATE TABLE IF NOT EXISTS training_attendance (
  id                    BIGSERIAL PRIMARY KEY,
  training_id           BIGINT NOT NULL REFERENCES training_records(id) ON DELETE CASCADE,
  user_id               TEXT NOT NULL,
  competencies_covered  TEXT[] DEFAULT '{}',                -- e.g. {'BA', 'PRPS', 'Driver LGV'}
  notes                 TEXT,                               -- individual development notes
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (training_id, user_id)                             -- one row per person per session
);

CREATE INDEX idx_training_attendance_user ON training_attendance (user_id);
CREATE INDEX idx_training_attendance_training ON training_attendance (training_id);
