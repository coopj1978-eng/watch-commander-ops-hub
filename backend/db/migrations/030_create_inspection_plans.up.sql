-- Multi-story inspections: quarterly, one watch per quarter
-- watch values: 'Red' | 'White' | 'Green' | 'Blue' | 'Amber'
CREATE TABLE multistory_inspections (
  id SERIAL PRIMARY KEY,
  address TEXT NOT NULL,
  q1_watch TEXT,
  q2_watch TEXT,
  q3_watch TEXT,
  q4_watch TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Care home validations: yearly, all watches attend (address register only)
CREATE TABLE care_home_validations (
  id SERIAL PRIMARY KEY,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Hydrant register: tabular format by area, street, section, year, watch
CREATE TABLE hydrant_registers (
  id SERIAL PRIMARY KEY,
  area_code TEXT NOT NULL,
  street TEXT NOT NULL,
  section TEXT NOT NULL,
  year INT NOT NULL,
  watch TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Operational inspections: yearly, single watch assigned, with UPRN reference
CREATE TABLE operational_inspections (
  id SERIAL PRIMARY KEY,
  address TEXT NOT NULL,
  uprn TEXT NOT NULL,
  watch TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
