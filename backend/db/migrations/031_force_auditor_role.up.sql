-- Force-correct any user with auditor email to AU role
-- This handles accounts created via sign-up that defaulted to FF
UPDATE users
SET role = 'AU', rank = 'Audit Officer', updated_at = NOW()
WHERE email = 'auditor@firestation.local' AND role != 'AU';

-- If no auditor account exists at all, create one with a known password
-- Password: AuditPass2026! (bcrypt hash)
INSERT INTO users (id, email, name, role, watch_unit, rank, password_hash, is_active, created_at, updated_at)
VALUES (
  'user_au1',
  'auditor@firestation.local',
  'Auditor Pat Reynolds',
  'AU',
  NULL,
  'Audit Officer',
  '$2b$10$3cRxL9a645iF08qjtONAhe0TirHC2UPE9OLLfkQKwnvEHrLrj66Uu',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  role = 'AU',
  rank = 'Audit Officer',
  is_active = true,
  updated_at = NOW();
