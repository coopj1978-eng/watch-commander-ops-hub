CREATE TABLE IF NOT EXISTS skill_renewals (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES firefighter_profiles(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  acquired_date DATE,
  renewal_date DATE,
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_renewals_profile_id ON skill_renewals(profile_id);
CREATE INDEX IF NOT EXISTS idx_skill_renewals_expiry_date ON skill_renewals(expiry_date);
CREATE INDEX IF NOT EXISTS idx_skill_renewals_skill_name ON skill_renewals(skill_name);
