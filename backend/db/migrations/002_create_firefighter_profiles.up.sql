CREATE TABLE firefighter_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_number TEXT UNIQUE,
  station TEXT,
  shift TEXT,
  rank TEXT,
  hire_date DATE,
  phone TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  skills TEXT[],
  certifications TEXT[],
  driver_lgv BOOLEAN DEFAULT FALSE,
  driver_erd BOOLEAN DEFAULT FALSE,
  prps BOOLEAN DEFAULT FALSE,
  ba BOOLEAN DEFAULT FALSE,
  notes TEXT,
  last_one_to_one_date DATE,
  next_one_to_one_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_firefighter_profiles_user_id ON firefighter_profiles(user_id);
CREATE INDEX idx_firefighter_profiles_service_number ON firefighter_profiles(service_number);
CREATE INDEX idx_firefighter_profiles_station ON firefighter_profiles(station);
