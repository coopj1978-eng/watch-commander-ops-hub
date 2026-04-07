-- Add feature flags to system_settings
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS feature_flags JSONB NOT NULL DEFAULT '{
  "dashboard": true,
  "people": true,
  "calendar": true,
  "tasks": false,
  "targets": false,
  "detachments": true,
  "equipment": false,
  "handover": false,
  "policies": false,
  "resources": false,
  "reports": false,
  "inspections": false
}'::jsonb;

-- Add is_admin flag to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Set coopj1978@gmail.com as admin
UPDATE users SET is_admin = true WHERE email = 'coopj1978@gmail.com';
