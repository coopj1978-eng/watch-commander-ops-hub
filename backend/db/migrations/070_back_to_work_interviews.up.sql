-- Back to work interviews (Oct 2026). When someone is booked back fit, a
-- back to work interview is due on their first rostered shift back. Their
-- watch's WC/CC and the person are told when they're booked fit and again
-- when that shift starts; it stays on the WC/CC dashboard until recorded.
-- Kept in its own table (one per sickness record) rather than new columns
-- on absences.
CREATE TABLE IF NOT EXISTS back_to_work_interviews (
  absence_id BIGINT PRIMARY KEY REFERENCES absences(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  due_at TIMESTAMPTZ NOT NULL,      -- start of their first shift back
  shift_label TEXT NOT NULL,        -- e.g. "1st Day Thu 29 Oct"
  reminded_at TIMESTAMPTZ,          -- reminder sent when that shift started
  done_at TIMESTAMPTZ,
  done_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_btw_outstanding ON back_to_work_interviews (due_at) WHERE done_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_btw_user ON back_to_work_interviews (user_id);
