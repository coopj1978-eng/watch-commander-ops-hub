CREATE TABLE IF NOT EXISTS dictionaries (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('skill', 'cert')),
  value TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(type, value)
);

CREATE INDEX IF NOT EXISTS idx_dictionaries_type ON dictionaries(type);
CREATE INDEX IF NOT EXISTS idx_dictionaries_active ON dictionaries(active);
CREATE INDEX IF NOT EXISTS idx_dictionaries_type_active ON dictionaries(type, active);

-- Insert default skills
INSERT INTO dictionaries (type, value) VALUES
  ('skill', 'First Aid'),
  ('skill', 'Water Rescue'),
  ('skill', 'Rope Rescue'),
  ('skill', 'BA'),
  ('skill', 'Driver')
ON CONFLICT (type, value) DO NOTHING;

-- Insert default certifications
INSERT INTO dictionaries (type, value) VALUES
  ('cert', 'HAZMAT Level 1'),
  ('cert', 'HAZMAT Level 2'),
  ('cert', 'Incident Command')
ON CONFLICT (type, value) DO NOTHING;
