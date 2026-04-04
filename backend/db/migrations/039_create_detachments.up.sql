CREATE TABLE IF NOT EXISTS detachments (
  id                   SERIAL        PRIMARY KEY,
  firefighter_id       VARCHAR       NOT NULL,
  firefighter_name     VARCHAR       NOT NULL,
  home_watch           VARCHAR       NOT NULL,
  to_station           VARCHAR       NOT NULL,
  detachment_date      DATE          NOT NULL,
  reason               VARCHAR,
  notes                TEXT,
  recorded_by_user_id  VARCHAR       NOT NULL,
  created_at           TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_detachments_firefighter ON detachments(firefighter_id);
CREATE INDEX IF NOT EXISTS idx_detachments_home_watch  ON detachments(home_watch);
CREATE INDEX IF NOT EXISTS idx_detachments_date        ON detachments(detachment_date DESC);
