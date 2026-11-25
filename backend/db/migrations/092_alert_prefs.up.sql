-- Each person's own switches for the "extra" bell alerts (John, 25 Nov 2026).
-- The important ones always ring; these are off unless the person turns
-- them on in Settings. See backend/lib/bellRules.ts.
CREATE TABLE IF NOT EXISTS user_alert_prefs (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  watch_tasks BOOLEAN NOT NULL DEFAULT FALSE,  -- every overdue task on your watch, not only yours
  certs_soon  BOOLEAN NOT NULL DEFAULT FALSE,  -- WC/CC: certificates on your watch within 30 days of expiring
  bookings    BOOLEAN NOT NULL DEFAULT FALSE,  -- WC/CC: someone on your watch logs TOIL, an orange day, training, overtime
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
