CREATE TABLE system_settings (
  id SERIAL PRIMARY KEY,
  skills_dictionary TEXT[] DEFAULT '{}',
  certifications_dictionary TEXT[] DEFAULT '{}',
  absence_threshold_days INTEGER DEFAULT 10,
  absence_threshold_period_months INTEGER DEFAULT 6,
  branding_logo_url TEXT,
  branding_primary_color TEXT,
  branding_secondary_color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO system_settings (
  skills_dictionary,
  certifications_dictionary,
  absence_threshold_days,
  absence_threshold_period_months
) VALUES (
  ARRAY['BA', 'Driver - LGV', 'Driver - ERD', 'PRPS', 'First Aid', 'Hazmat', 'Rope Rescue', 'Swift Water']::TEXT[],
  ARRAY['BA Wearer', 'BA Team Leader', 'LGV License', 'ERD License', 'PRPS Certified', 'First Aid Level 3', 'Hazmat Operations', 'Technical Rescue']::TEXT[],
  10,
  6
);
