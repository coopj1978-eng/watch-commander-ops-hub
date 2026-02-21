-- Add Audit (AU) role to the users table role constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('WC', 'CC', 'FF', 'RO', 'AU'));
