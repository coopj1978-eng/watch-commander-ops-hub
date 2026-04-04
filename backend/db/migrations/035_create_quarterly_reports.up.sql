CREATE TABLE quarterly_reports (
  id BIGSERIAL PRIMARY KEY,
  station_name TEXT NOT NULL DEFAULT '',
  watch TEXT NOT NULL,
  watch_commander_name TEXT NOT NULL,
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  financial_year INTEGER NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (watch, quarter, financial_year)
);

CREATE INDEX idx_quarterly_reports_watch ON quarterly_reports(watch);
CREATE INDEX idx_quarterly_reports_period ON quarterly_reports(financial_year, quarter);
CREATE INDEX idx_quarterly_reports_created_by ON quarterly_reports(created_by);

CREATE TABLE quarterly_report_items (
  id BIGSERIAL PRIMARY KEY,
  report_id BIGINT NOT NULL REFERENCES quarterly_reports(id) ON DELETE CASCADE,
  kpi_code TEXT NOT NULL,
  description TEXT NOT NULL,
  target_text TEXT NOT NULL,
  row_color TEXT NOT NULL DEFAULT 'FFFFFF',
  category TEXT NOT NULL DEFAULT 'Operational',
  sort_order INTEGER NOT NULL DEFAULT 0,
  met BOOLEAN NOT NULL DEFAULT FALSE,
  actual_value TEXT,
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qr_items_report_id ON quarterly_report_items(report_id);

CREATE TABLE quarterly_report_custom_items (
  id BIGSERIAL PRIMARY KEY,
  report_id BIGINT NOT NULL REFERENCES quarterly_reports(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  target_text TEXT,
  met BOOLEAN NOT NULL DEFAULT FALSE,
  rationale TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qr_custom_items_report_id ON quarterly_report_custom_items(report_id);
