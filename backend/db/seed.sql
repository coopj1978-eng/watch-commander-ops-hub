-- Seed data for Watch Commander Ops Hub
-- Run this after migrations to populate initial test data

-- Clear existing data (in reverse dependency order)
DELETE FROM calendar_events;
DELETE FROM activity_log;
DELETE FROM policy_queries;
DELETE FROM policy_documents;
DELETE FROM targets;
DELETE FROM absences;
DELETE FROM tasks;
DELETE FROM inspections;
DELETE FROM firefighter_profiles;
DELETE FROM users;

-- 1 Watch Commander
INSERT INTO users (id, email, name, role, watch_unit, rank, avatar_url, created_at, updated_at) VALUES
('user_wc1', 'wc@firestation.local', 'Commander Sarah Mitchell', 'WC', 'Blue Watch', 'Watch Commander', NULL, NOW(), NOW());

-- 2 Crew Commanders
INSERT INTO users (id, email, name, role, watch_unit, rank, avatar_url, created_at, updated_at) VALUES
('user_cc1', 'cc1@firestation.local', 'Lieutenant James Rodriguez', 'CC', 'Blue Watch', 'Crew Commander', NULL, NOW(), NOW()),
('user_cc2', 'cc2@firestation.local', 'Lieutenant Emma Thompson', 'CC', 'Blue Watch', 'Crew Commander', NULL, NOW(), NOW());

-- 12 Firefighters (6 per crew commander)
INSERT INTO users (id, email, name, role, watch_unit, rank, avatar_url, created_at, updated_at) VALUES
-- CC1's Crew
('user_ff1', 'ff1@firestation.local', 'FF Michael Chen', 'FF', 'Blue Watch', 'Firefighter', NULL, NOW(), NOW()),
('user_ff2', 'ff2@firestation.local', 'FF Lisa Anderson', 'FF', 'Blue Watch', 'Firefighter', NULL, NOW(), NOW()),
('user_ff3', 'ff3@firestation.local', 'FF David Martinez', 'FF', 'Blue Watch', 'Firefighter', NULL, NOW(), NOW()),
('user_ff4', 'ff4@firestation.local', 'FF Rachel Green', 'FF', 'Blue Watch', 'Leading Firefighter', NULL, NOW(), NOW()),
('user_ff5', 'ff5@firestation.local', 'FF Tom Wilson', 'FF', 'Blue Watch', 'Firefighter', NULL, NOW(), NOW()),
('user_ff6', 'ff6@firestation.local', 'FF Sarah Johnson', 'FF', 'Blue Watch', 'Firefighter', NULL, NOW(), NOW()),
-- CC2's Crew
('user_ff7', 'ff7@firestation.local', 'FF Ahmed Hassan', 'FF', 'Blue Watch', 'Firefighter', NULL, NOW(), NOW()),
('user_ff8', 'ff8@firestation.local', 'FF Maria Garcia', 'FF', 'Blue Watch', 'Leading Firefighter', NULL, NOW(), NOW()),
('user_ff9', 'ff9@firestation.local', 'FF Robert Brown', 'FF', 'Blue Watch', 'Firefighter', NULL, NOW(), NOW()),
('user_ff10', 'ff10@firestation.local', 'FF Jennifer Lee', 'FF', 'Blue Watch', 'Firefighter', NULL, NOW(), NOW()),
('user_ff11', 'ff11@firestation.local', 'FF Kevin O''Brien', 'FF', 'Blue Watch', 'Firefighter', NULL, NOW(), NOW()),
('user_ff12', 'ff12@firestation.local', 'FF Sophie Taylor', 'FF', 'Blue Watch', 'Firefighter', NULL, NOW(), NOW());

-- 1 Auditor (with password hash for AuditPass2026!)
INSERT INTO users (id, email, name, role, watch_unit, rank, avatar_url, password_hash, is_active, created_at, updated_at) VALUES
('user_au1', 'auditor@firestation.local', 'Auditor Pat Reynolds', 'AU', NULL, 'Audit Officer', NULL, '$2b$10$3cRxL9a645iF08qjtONAhe0TirHC2UPE9OLLfkQKwnvEHrLrj66Uu', true, NOW(), NOW());

-- Firefighter Profiles
INSERT INTO firefighter_profiles (
  user_id, service_number, station, shift, rank, hire_date, phone,
  emergency_contact_name, emergency_contact_phone, skills, certifications,
  driver_lgv, driver_erd, prps, ba, notes, last_one_to_one_date, next_one_to_one_date,
  created_at, updated_at
) VALUES
-- CC1's Crew
('user_ff1', 'FF-2018-001', 'Station A', 'Blue Watch', 'Firefighter', '2018-03-15', '555-0101', 'Lisa Chen', '555-0201', ARRAY['BA', 'Driver - LGV', 'First Aid'], ARRAY['BA Wearer', 'LGV License', 'First Aid Level 3'], true, false, false, true, 'Experienced driver, BA qualified', '2025-10-15', '2025-12-15', NOW(), NOW()),
('user_ff2', 'FF-2019-002', 'Station A', 'Blue Watch', 'Firefighter', '2019-06-01', '555-0102', 'Mark Anderson', '555-0202', ARRAY['BA', 'PRPS', 'Rope Rescue'], ARRAY['BA Wearer', 'PRPS Certified', 'Technical Rescue'], false, false, true, true, 'PRPS specialist', '2025-10-20', '2025-12-20', NOW(), NOW()),
('user_ff3', 'FF-2020-003', 'Station A', 'Blue Watch', 'Firefighter', '2020-01-10', '555-0103', 'Ana Martinez', '555-0203', ARRAY['BA', 'Hazmat'], ARRAY['BA Wearer', 'Hazmat Operations'], false, false, false, true, NULL, '2025-11-01', '2026-01-01', NOW(), NOW()),
('user_ff4', 'FF-2017-004', 'Station A', 'Blue Watch', 'Leading Firefighter', '2017-09-20', '555-0104', 'John Green', '555-0204', ARRAY['BA', 'Driver - ERD', 'First Aid'], ARRAY['BA Team Leader', 'ERD License', 'First Aid Level 3'], false, true, false, true, 'Senior crew member', '2025-09-15', '2025-11-15', NOW(), NOW()),
('user_ff5', 'FF-2021-005', 'Station A', 'Blue Watch', 'Firefighter', '2021-04-05', '555-0105', 'Karen Wilson', '555-0205', ARRAY['BA', 'Swift Water'], ARRAY['BA Wearer'], false, false, false, true, 'New to team', '2025-11-10', '2026-01-10', NOW(), NOW()),
('user_ff6', 'FF-2019-006', 'Station A', 'Blue Watch', 'Firefighter', '2019-11-12', '555-0106', 'Mike Johnson', '555-0206', ARRAY['BA', 'Driver - LGV', 'Hazmat'], ARRAY['BA Wearer', 'LGV License', 'Hazmat Operations'], true, false, false, true, NULL, '2025-10-25', '2025-12-25', NOW(), NOW()),
-- CC2's Crew
('user_ff7', 'FF-2018-007', 'Station A', 'Blue Watch', 'Firefighter', '2018-07-22', '555-0107', 'Fatima Hassan', '555-0207', ARRAY['BA', 'First Aid', 'Rope Rescue'], ARRAY['BA Wearer', 'First Aid Level 3', 'Technical Rescue'], false, false, false, true, 'First aid qualified', '2025-10-18', '2025-12-18', NOW(), NOW()),
('user_ff8', 'FF-2016-008', 'Station A', 'Blue Watch', 'Leading Firefighter', '2016-05-30', '555-0108', 'Carlos Garcia', '555-0208', ARRAY['BA', 'Driver - LGV', 'Driver - ERD', 'PRPS'], ARRAY['BA Team Leader', 'LGV License', 'ERD License', 'PRPS Certified'], true, true, true, true, 'Highly experienced, all qualifications', '2025-09-10', '2025-11-10', NOW(), NOW()),
('user_ff9', 'FF-2020-009', 'Station A', 'Blue Watch', 'Firefighter', '2020-08-14', '555-0109', 'Susan Brown', '555-0209', ARRAY['BA', 'Hazmat'], ARRAY['BA Wearer', 'Hazmat Operations'], false, false, false, true, NULL, '2025-11-05', '2026-01-05', NOW(), NOW()),
('user_ff10', 'FF-2019-010', 'Station A', 'Blue Watch', 'Firefighter', '2019-02-28', '555-0110', 'Tim Lee', '555-0210', ARRAY['BA', 'Swift Water', 'First Aid'], ARRAY['BA Wearer', 'First Aid Level 3'], false, false, false, true, 'Swift water rescue trained', '2025-10-22', '2025-12-22', NOW(), NOW()),
('user_ff11', 'FF-2021-011', 'Station A', 'Blue Watch', 'Firefighter', '2021-09-01', '555-0111', 'Mary O''Brien', '555-0211', ARRAY['BA'], ARRAY['BA Wearer'], false, false, false, true, 'Recently joined', '2025-11-08', '2026-01-08', NOW(), NOW()),
('user_ff12', 'FF-2018-012', 'Station A', 'Blue Watch', 'Firefighter', '2018-12-03', '555-0112', 'Dan Taylor', '555-0212', ARRAY['BA', 'Driver - LGV', 'Rope Rescue'], ARRAY['BA Wearer', 'LGV License', 'Technical Rescue'], true, false, false, true, NULL, '2025-10-28', '2025-12-28', NOW(), NOW());

-- Auditor Profile
INSERT INTO firefighter_profiles (
  user_id, rolling_sick_episodes, rolling_sick_days,
  trigger_stage, driver_lgv, driver_erd, created_at, updated_at
) VALUES
('user_au1', 0, 0, 'None', false, false, NOW(), NOW());

-- 30 Tasks (mixed categories, priorities, statuses)
INSERT INTO tasks (
  title, description, category, assigned_to_user_id, assigned_by, status, priority, due_at, created_at, updated_at
) VALUES
-- Training tasks
('Complete BA Training Recert', 'Annual BA recertification due', 'Training', 'user_ff1', 'user_cc1', 'NotStarted', 'High', NOW() + INTERVAL '5 days', NOW(), NOW()),
('First Aid Refresher Course', 'Level 3 first aid update', 'Training', 'user_ff2', 'user_cc1', 'NotStarted', 'Med', NOW() + INTERVAL '10 days', NOW(), NOW()),
('LGV Driver Assessment', 'Annual driving assessment', 'Training', 'user_ff4', 'user_cc1', 'InProgress', 'High', NOW() + INTERVAL '3 days', NOW(), NOW()),
('PRPS Certification Renewal', 'PRPS cert expiring soon', 'Training', 'user_ff8', 'user_cc2', 'Done', 'High', NOW() - INTERVAL '2 days', NOW(), NOW()),
('Swift Water Rescue Training', 'New qualification course', 'Training', 'user_ff10', 'user_cc2', 'NotStarted', 'Med', NOW() + INTERVAL '15 days', NOW(), NOW()),

-- Inspection tasks
('Pre-Inspection Planning - Tower Block A', 'Review site plans and risk assessment', 'Inspection', 'user_ff3', 'user_cc1', 'NotStarted', 'High', NOW() + INTERVAL '2 days', NOW(), NOW()),
('Hydrant Inspection Route 1', 'Monthly hydrant checks district 1', 'Inspection', 'user_ff5', 'user_cc1', 'InProgress', 'Med', NOW() + INTERVAL '7 days', NOW(), NOW()),
('High-Rise Inspection Report', 'Complete inspection documentation', 'Inspection', 'user_ff7', 'user_cc2', 'Done', 'Med', NOW() - INTERVAL '1 day', NOW(), NOW()),
('Local Property Visit - School', 'Safety inspection at primary school', 'Inspection', 'user_ff9', 'user_cc2', 'NotStarted', 'Low', NOW() + INTERVAL '12 days', NOW(), NOW()),

-- HFSV (Home Fire Safety Visits) tasks
('HFSV Campaign - Elm Street', 'Door-to-door fire safety visits', 'HFSV', 'user_ff1', 'user_cc1', 'InProgress', 'Med', NOW() + INTERVAL '8 days', NOW(), NOW()),
('HFSV Follow-up - Vulnerable Residents', 'Check smoke alarms installed', 'HFSV', 'user_ff6', 'user_cc1', 'NotStarted', 'High', NOW() + INTERVAL '4 days', NOW(), NOW()),
('HFSV Data Entry - October', 'Update HFSV database with October visits', 'HFSV', 'user_ff11', 'user_cc2', 'Done', 'Low', NOW() - INTERVAL '3 days', NOW(), NOW()),
('Community Outreach Event', 'Fire safety presentation at community center', 'HFSV', 'user_ff12', 'user_cc2', 'NotStarted', 'Med', NOW() + INTERVAL '14 days', NOW(), NOW()),

-- Admin tasks
('Equipment Inventory Check', 'Quarterly inventory of PPE and equipment', 'Admin', 'user_ff2', 'user_wc1', 'NotStarted', 'Med', NOW() + INTERVAL '6 days', NOW(), NOW()),
('Update Training Records', 'Ensure all certs are current in system', 'Admin', 'user_ff4', 'user_wc1', 'InProgress', 'High', NOW() + INTERVAL '1 day', NOW(), NOW()),
('Vehicle Maintenance Log', 'Complete monthly vehicle checks', 'Admin', 'user_ff8', 'user_cc2', 'Done', 'Med', NOW() - INTERVAL '4 days', NOW(), NOW()),
('Monthly Station Inspection', 'Health and safety station walkthrough', 'Admin', 'user_cc1', 'user_wc1', 'NotStarted', 'Med', NOW() + INTERVAL '9 days', NOW(), NOW()),
('Shift Handover Notes', 'Prepare detailed handover for Red Watch', 'Admin', 'user_cc2', 'user_wc1', 'InProgress', 'Low', NOW() + INTERVAL '2 days', NOW(), NOW()),

-- Other/Mixed tasks
('Review New SOPs', 'Read and acknowledge new operational procedures', 'Other', 'user_ff3', 'user_wc1', 'NotStarted', 'High', NOW() + INTERVAL '3 days', NOW(), NOW()),
('Uniform Requisition', 'Order replacement uniform items', 'Other', 'user_ff5', 'user_cc1', 'Done', 'Low', NOW() - INTERVAL '5 days', NOW(), NOW()),
('Fitness Assessment', 'Annual fitness test booking', 'Other', 'user_ff7', 'user_cc2', 'NotStarted', 'Med', NOW() + INTERVAL '20 days', NOW(), NOW()),
('Station Open Day Preparation', 'Help organize public open day', 'Other', 'user_ff9', 'user_cc2', 'InProgress', 'Med', NOW() + INTERVAL '18 days', NOW(), NOW()),
('Mentoring New Recruit', 'Support probationer development', 'Other', 'user_ff4', 'user_cc1', 'InProgress', 'Low', NOW() + INTERVAL '30 days', NOW(), NOW()),

-- Overdue tasks (for testing)
('Overdue Equipment Check', 'Breathing apparatus set inspection', 'Admin', 'user_ff6', 'user_cc1', 'NotStarted', 'High', NOW() - INTERVAL '2 days', NOW(), NOW()),
('Overdue Training Module', 'Complete online hazmat training', 'Training', 'user_ff10', 'user_cc2', 'NotStarted', 'Med', NOW() - INTERVAL '5 days', NOW(), NOW()),
('Late Inspection Report', 'Submit inspection findings', 'Inspection', 'user_ff11', 'user_cc2', 'InProgress', 'High', NOW() - INTERVAL '1 day', NOW(), NOW()),

-- Completed tasks (various dates)
('Weekly Drill Attendance', 'Attend pump operations drill', 'Training', 'user_ff1', 'user_cc1', 'Done', 'Med', NOW() - INTERVAL '7 days', NOW(), NOW()),
('Station Cleaning Rota', 'Complete weekly station duties', 'Admin', 'user_ff2', 'user_cc1', 'Done', 'Low', NOW() - INTERVAL '3 days', NOW(), NOW()),
('Policy Review - Absence Management', 'Read updated absence policy', 'Admin', 'user_ff12', 'user_wc1', 'Done', 'Med', NOW() - INTERVAL '6 days', NOW(), NOW()),
('Community Event Setup', 'Set up equipment for school visit', 'HFSV', 'user_ff8', 'user_cc2', 'Done', 'Low', NOW() - INTERVAL '8 days', NOW(), NOW());

-- 10 Inspections with crew assignments
INSERT INTO inspections (
  type, address, priority, scheduled_for, assigned_crew_ids, status, notes, created_at, updated_at
) VALUES
('HighRise', '123 Tower Heights, High Street', 'high', NOW() + INTERVAL '3 days', ARRAY['user_ff1', 'user_ff3', 'user_cc1'], 'Planned', '24-story residential building, annual inspection', NOW(), NOW()),
('HighRise', '456 Skyline Apartments, Central Avenue', 'critical', NOW() + INTERVAL '1 day', ARRAY['user_ff4', 'user_ff6', 'user_cc1'], 'InProgress', 'Fire alarm system upgrade verification', NOW(), NOW()),
('LocalProperty', 'Riverside Primary School, Oak Lane', 'medium', NOW() + INTERVAL '7 days', ARRAY['user_ff2', 'user_ff5'], 'Planned', 'Annual school safety inspection', NOW(), NOW()),
('LocalProperty', 'Green Valley Care Home, Maple Road', 'high', NOW() + INTERVAL '2 days', ARRAY['user_ff7', 'user_ff9', 'user_cc2'], 'Planned', 'Vulnerable occupants, priority inspection', NOW(), NOW()),
('Hydrant', 'District 1 - North Sector', 'low', NOW() + INTERVAL '10 days', ARRAY['user_ff5', 'user_ff6'], 'Planned', 'Monthly hydrant maintenance checks', NOW(), NOW()),
('Hydrant', 'District 2 - East Sector', 'medium', NOW() + INTERVAL '5 days', ARRAY['user_ff10', 'user_ff12'], 'Planned', 'Hydrant flow testing required', NOW(), NOW()),
('LocalProperty', 'City Shopping Mall, Commerce Street', 'high', NOW() + INTERVAL '4 days', ARRAY['user_ff8', 'user_ff11', 'user_cc2'], 'Planned', 'Large public venue, quarterly inspection', NOW(), NOW()),
('HighRise', '789 Metropolitan Tower, Business District', 'medium', NOW() + INTERVAL '15 days', ARRAY['user_ff1', 'user_ff2', 'user_cc1'], 'Planned', 'Office building, routine check', NOW(), NOW()),
('Other', 'Industrial Estate - Warehouse Complex', 'high', NOW() + INTERVAL '6 days', ARRAY['user_ff3', 'user_ff4', 'user_ff7'], 'Planned', 'Hazmat storage facility inspection', NOW(), NOW()),
('LocalProperty', 'Community Sports Center, Park Road', 'low', NOW() - INTERVAL '2 days', ARRAY['user_ff9', 'user_ff10'], 'Complete', 'Inspection completed, no issues found', NOW(), NOW());

-- Current Month Targets
INSERT INTO targets (
  metric_name, target_value, current_value, target_date, category, assigned_to, created_at, updated_at
) VALUES
('HFSV Completions', 150, 112, DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day', 'HFSV', 'user_wc1', NOW(), NOW()),
('High-Rise Inspections', 8, 6, DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day', 'Inspections', 'user_wc1', NOW(), NOW()),
('Hydrant Inspections', 50, 38, DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day', 'Inspections', 'user_wc1', NOW(), NOW()),
('Training Certifications', 12, 9, DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day', 'Training', 'user_wc1', NOW(), NOW()),
('Local Property Visits', 25, 19, DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day', 'Inspections', 'user_wc1', NOW(), NOW()),
('Community Events', 4, 3, DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day', 'Community', 'user_wc1', NOW(), NOW());

-- 3 Absences covering all trigger stages
INSERT INTO absences (
  firefighter_id, absence_type, start_date, end_date, total_days, reason, status, approved_by, created_by_user_id, created_at, updated_at
) VALUES
('user_ff3', 'AL', NOW() + INTERVAL '10 days', NOW() + INTERVAL '17 days', 8, 'Family vacation', 'approved', 'user_cc1', 'user_ff3', NOW(), NOW()),
('user_ff7', 'sickness', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day', 3, 'Flu symptoms', 'pending', NULL, 'user_ff7', NOW(), NOW()),
('user_ff11', 'other', NOW() + INTERVAL '5 days', NOW() + INTERVAL '7 days', 3, 'External fire investigation course', 'approved', 'user_cc2', 'user_ff11', NOW(), NOW()),
('user_ff5', 'sickness', NOW() - INTERVAL '45 days', NOW() - INTERVAL '42 days', 4, 'Back injury', 'approved', 'user_cc1', 'user_ff5', NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),
('user_ff5', 'sickness', NOW() - INTERVAL '30 days', NOW() - INTERVAL '28 days', 3, 'Cold and flu', 'approved', 'user_cc1', 'user_ff5', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
('user_ff9', 'sickness', NOW() - INTERVAL '120 days', NOW() - INTERVAL '118 days', 3, 'Migraine', 'approved', 'user_cc2', 'user_ff9', NOW() - INTERVAL '120 days', NOW() - INTERVAL '120 days'),
('user_ff9', 'sickness', NOW() - INTERVAL '90 days', NOW() - INTERVAL '88 days', 3, 'Stomach bug', 'approved', 'user_cc2', 'user_ff9', NOW() - INTERVAL '90 days', NOW() - INTERVAL '90 days'),
('user_ff9', 'sickness', NOW() - INTERVAL '60 days', NOW() - INTERVAL '58 days', 3, 'Dental surgery', 'approved', 'user_cc2', 'user_ff9', NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days'),
('user_ff9', 'sickness', NOW() - INTERVAL '20 days', NOW() - INTERVAL '18 days', 3, 'Cold', 'approved', 'user_cc2', 'user_ff9', NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days');

-- 5 Policy Documents (with mocked vector IDs for testing)
INSERT INTO policy_documents (
  title, file_key, category, uploaded_by, vector_id, uploaded_at, created_at, updated_at
) VALUES
('High-Rise Building Fire Safety Protocol', 'policies/high-rise-protocol-2024.pdf', 'Operations', 'user_wc1', 'mock_vector_highrise_001', NOW() - INTERVAL '30 days', NOW(), NOW()),
('Absence Management Policy', 'policies/absence-management-v3.pdf', 'HR', 'user_wc1', 'mock_vector_absence_002', NOW() - INTERVAL '45 days', NOW(), NOW()),
('Home Fire Safety Visit Guidelines', 'policies/hfsv-guidelines-2024.pdf', 'Community', 'user_wc1', 'mock_vector_hfsv_003', NOW() - INTERVAL '60 days', NOW(), NOW()),
('Hydrant Inspection Standard Operating Procedure', 'policies/hydrant-inspection-sop.pdf', 'Operations', 'user_wc1', 'mock_vector_hydrant_004', NOW() - INTERVAL '90 days', NOW(), NOW()),
('Training and Development Framework', 'policies/training-framework-2024.pdf', 'Training', 'user_wc1', 'mock_vector_training_005', NOW() - INTERVAL '15 days', NOW(), NOW());

-- Calendar Events (for visual testing of month view with colored dots)
INSERT INTO calendar_events (
  title, description, start_time, end_time, all_day, created_by, created_at, updated_at
) VALUES
-- This month events
('Watch Changeover - Blue to Red', 'End of Blue Watch shift rotation', DATE_TRUNC('month', NOW()) + INTERVAL '15 days' + TIME '08:00:00', DATE_TRUNC('month', NOW()) + INTERVAL '15 days' + TIME '09:00:00', false, 'user_wc1', NOW(), NOW()),
('Safety Briefing - All Watch', 'Monthly safety and operational update', DATE_TRUNC('month', NOW()) + INTERVAL '5 days' + TIME '09:00:00', DATE_TRUNC('month', NOW()) + INTERVAL '5 days' + TIME '10:00:00', false, 'user_wc1', NOW(), NOW()),
('Equipment Training Session', 'New thermal imaging camera demonstration', DATE_TRUNC('month', NOW()) + INTERVAL '12 days' + TIME '14:00:00', DATE_TRUNC('month', NOW()) + INTERVAL '12 days' + TIME '16:00:00', false, 'user_cc1', NOW(), NOW()),
('Station Inspection - Fire Authority', 'Quarterly inspection by fire authority', DATE_TRUNC('month', NOW()) + INTERVAL '20 days' + TIME '10:00:00', DATE_TRUNC('month', NOW()) + INTERVAL '20 days' + TIME '12:00:00', false, 'user_wc1', NOW(), NOW()),
('Community Open Day', 'Public engagement event at station', DATE_TRUNC('month', NOW()) + INTERVAL '25 days' + TIME '10:00:00', DATE_TRUNC('month', NOW()) + INTERVAL '25 days' + TIME '16:00:00', false, 'user_wc1', NOW(), NOW()),
('Drill - Multi-Pump Exercise', 'Joint training with neighboring stations', DATE_TRUNC('month', NOW()) + INTERVAL '8 days' + TIME '13:00:00', DATE_TRUNC('month', NOW()) + INTERVAL '8 days' + TIME '15:00:00', false, 'user_cc2', NOW(), NOW()),
('Fitness Testing Day', 'Annual fitness assessments', DATE_TRUNC('month', NOW()) + INTERVAL '18 days', DATE_TRUNC('month', NOW()) + INTERVAL '18 days', true, 'user_wc1', NOW(), NOW()),
('BA Maintenance Workshop', 'Breathing apparatus maintenance training', DATE_TRUNC('month', NOW()) + INTERVAL '10 days' + TIME '09:00:00', DATE_TRUNC('month', NOW()) + INTERVAL '10 days' + TIME '12:00:00', false, 'user_cc1', NOW(), NOW()),
-- Events on same day as tasks (for testing modal display)
('Morning Briefing', 'Daily operational briefing', NOW() + INTERVAL '3 days' + TIME '08:00:00', NOW() + INTERVAL '3 days' + TIME '08:30:00', false, 'user_cc1', NOW(), NOW()),
('Shift Debrief', 'End of shift review', NOW() + INTERVAL '7 days' + TIME '17:00:00', NOW() + INTERVAL '7 days' + TIME '17:30:00', false, 'user_cc2', NOW(), NOW());

-- Initial Settings
INSERT INTO settings (key, value, created_at, updated_at) VALUES
('absence_thresholds', '{"stage1Days":7,"stage1Episodes":3,"stage2Days":10,"stage2Episodes":4,"stage3Days":14,"stage3Episodes":5}', NOW(), NOW()),
('branding', '{"stationName":"Station A - Blue Watch","logo":"","primaryColor":"#3B82F6"}', NOW(), NOW()),
('skills_certs', '{"skills":["BA","Driver - LGV","Driver - ERD","PRPS","First Aid","Rope Rescue","Swift Water","Hazmat"],"certifications":["BA Wearer","BA Team Leader","LGV License","ERD License","PRPS Certified","First Aid Level 3","Technical Rescue","Hazmat Operations"]}', NOW(), NOW());
