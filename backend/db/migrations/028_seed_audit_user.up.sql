-- Add Audit test user with sign-in credentials
-- Email: auditor@firestation.local | Password: AuditPass2026!
INSERT INTO users (id, email, name, password_hash, role, watch_unit, rank, is_active, created_at, updated_at)
VALUES (
  'user_au1',
  'auditor@firestation.local',
  'Auditor Pat Reynolds',
  '$2b$10$3cRxL9a645iF08qjtONAhe0TirHC2UPE9OLLfkQKwnvEHrLrj66Uu',
  'AU',
  NULL,
  'Audit Officer',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO firefighter_profiles (
  user_id, rolling_sick_episodes, rolling_sick_days,
  trigger_stage, driver_lgv, driver_erd
)
VALUES (
  'user_au1', 0, 0, 'None', false, false
)
ON CONFLICT DO NOTHING;
