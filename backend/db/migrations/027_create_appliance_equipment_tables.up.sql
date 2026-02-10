-- Appliances (vehicles/units at a station)
CREATE TABLE IF NOT EXISTS appliances (
  id SERIAL PRIMARY KEY,
  call_sign TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Rescue', 'Decon', 'Aerial', 'Special', 'Other')),
  station_call_sign TEXT NOT NULL,
  station_name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appliances_station ON appliances(station_call_sign);
CREATE INDEX IF NOT EXISTS idx_appliances_active ON appliances(active);

-- Equipment items assigned to each appliance
CREATE TABLE IF NOT EXISTS equipment_items (
  id SERIAL PRIMARY KEY,
  appliance_id INTEGER NOT NULL REFERENCES appliances(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('BA', 'Ladders', 'Hose', 'TIC', 'PPE', 'Tools', 'Medical', 'Other')),
  serial_number TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_items_appliance ON equipment_items(appliance_id);
CREATE INDEX IF NOT EXISTS idx_equipment_items_category ON equipment_items(category);
CREATE INDEX IF NOT EXISTS idx_equipment_items_active ON equipment_items(active);

-- Equipment check sessions (a J4 check)
CREATE TABLE IF NOT EXISTS equipment_checks (
  id SERIAL PRIMARY KEY,
  appliance_id INTEGER NOT NULL REFERENCES appliances(id) ON DELETE CASCADE,
  checked_by TEXT NOT NULL REFERENCES users(id),
  watch TEXT NOT NULL CHECK (watch IN ('Day', 'Night')),
  status TEXT NOT NULL DEFAULT 'InProgress' CHECK (status IN ('InProgress', 'Complete')),
  notes TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_checks_appliance ON equipment_checks(appliance_id);
CREATE INDEX IF NOT EXISTS idx_equipment_checks_checked_by ON equipment_checks(checked_by);
CREATE INDEX IF NOT EXISTS idx_equipment_checks_status ON equipment_checks(status);
CREATE INDEX IF NOT EXISTS idx_equipment_checks_started_at ON equipment_checks(started_at DESC);

-- Individual item results within a check
CREATE TABLE IF NOT EXISTS equipment_check_items (
  id SERIAL PRIMARY KEY,
  check_id INTEGER NOT NULL REFERENCES equipment_checks(id) ON DELETE CASCADE,
  equipment_item_id INTEGER NOT NULL REFERENCES equipment_items(id),
  status TEXT NOT NULL DEFAULT 'OK' CHECK (status IN ('OK', 'Defective', 'Missing')),
  quantity_checked INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_check_items_check ON equipment_check_items(check_id);
CREATE INDEX IF NOT EXISTS idx_check_items_equipment ON equipment_check_items(equipment_item_id);
CREATE INDEX IF NOT EXISTS idx_check_items_status ON equipment_check_items(status);

-- Defect tracking for flagged equipment
CREATE TABLE IF NOT EXISTS equipment_defects (
  id SERIAL PRIMARY KEY,
  check_item_id INTEGER REFERENCES equipment_check_items(id),
  equipment_item_id INTEGER NOT NULL REFERENCES equipment_items(id),
  appliance_id INTEGER NOT NULL REFERENCES appliances(id),
  reported_by TEXT NOT NULL REFERENCES users(id),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Ordered', 'Resolved')),
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_defects_equipment ON equipment_defects(equipment_item_id);
CREATE INDEX IF NOT EXISTS idx_defects_appliance ON equipment_defects(appliance_id);
CREATE INDEX IF NOT EXISTS idx_defects_status ON equipment_defects(status);
CREATE INDEX IF NOT EXISTS idx_defects_reported_at ON equipment_defects(reported_at DESC);

-- Seed data for B10 Springburn station
INSERT INTO appliances (call_sign, name, type, station_call_sign, station_name) VALUES
  ('B10P1', 'Main Rescue Appliance', 'Rescue', 'B10', 'Springburn'),
  ('B10P2', '2nd Rescue Appliance', 'Rescue', 'B10', 'Springburn'),
  ('B10T1', 'Mass Decontamination Unit', 'Decon', 'B10', 'Springburn');

-- Equipment for B10P1
INSERT INTO equipment_items (appliance_id, name, category, serial_number, quantity) VALUES
  ((SELECT id FROM appliances WHERE call_sign = 'B10P1'), 'BA Set 1030', 'BA', '1030', 1),
  ((SELECT id FROM appliances WHERE call_sign = 'B10P1'), 'BA Set 1031', 'BA', '1031', 1),
  ((SELECT id FROM appliances WHERE call_sign = 'B10P1'), 'BA Set 1032', 'BA', '1032', 1),
  ((SELECT id FROM appliances WHERE call_sign = 'B10P1'), 'BA Set 1034', 'BA', '1034', 1),
  ((SELECT id FROM appliances WHERE call_sign = 'B10P1'), '13.5m Ladder', 'Ladders', NULL, 1),
  ((SELECT id FROM appliances WHERE call_sign = 'B10P1'), '9m Ladder', 'Ladders', NULL, 1),
  ((SELECT id FROM appliances WHERE call_sign = 'B10P1'), 'Short Extension Ladder', 'Ladders', NULL, 1),
  ((SELECT id FROM appliances WHERE call_sign = 'B10P1'), 'Roof Ladder', 'Ladders', NULL, 1),
  ((SELECT id FROM appliances WHERE call_sign = 'B10P1'), 'Thermal Image Camera', 'TIC', NULL, 1),
  ((SELECT id FROM appliances WHERE call_sign = 'B10P1'), '70mm Hose', 'Hose', NULL, 6),
  ((SELECT id FROM appliances WHERE call_sign = 'B10P1'), '45mm Hose', 'Hose', NULL, 2),
  ((SELECT id FROM appliances WHERE call_sign = 'B10P1'), '100mm Hose', 'Hose', NULL, 1);

-- Equipment for B10P2
INSERT INTO equipment_items (appliance_id, name, category, serial_number, quantity) VALUES
  ((SELECT id FROM appliances WHERE call_sign = 'B10P2'), 'BA Set 191', 'BA', '191', 1),
  ((SELECT id FROM appliances WHERE call_sign = 'B10P2'), 'BA Set 192', 'BA', '192', 1),
  ((SELECT id FROM appliances WHERE call_sign = 'B10P2'), 'BA Set 193', 'BA', '193', 1),
  ((SELECT id FROM appliances WHERE call_sign = 'B10P2'), 'BA Set 194', 'BA', '194', 1),
  ((SELECT id FROM appliances WHERE call_sign = 'B10P2'), '13.5m Ladder', 'Ladders', NULL, 1),
  ((SELECT id FROM appliances WHERE call_sign = 'B10P2'), '9m Ladder', 'Ladders', NULL, 1),
  ((SELECT id FROM appliances WHERE call_sign = 'B10P2'), 'Short Extension Ladder', 'Ladders', NULL, 1),
  ((SELECT id FROM appliances WHERE call_sign = 'B10P2'), 'Roof Ladder', 'Ladders', NULL, 1),
  ((SELECT id FROM appliances WHERE call_sign = 'B10P2'), 'Thermal Image Camera', 'TIC', NULL, 1),
  ((SELECT id FROM appliances WHERE call_sign = 'B10P2'), '70mm Hose', 'Hose', NULL, 6),
  ((SELECT id FROM appliances WHERE call_sign = 'B10P2'), '45mm Hose', 'Hose', NULL, 2),
  ((SELECT id FROM appliances WHERE call_sign = 'B10P2'), '100mm Hose', 'Hose', NULL, 1);
