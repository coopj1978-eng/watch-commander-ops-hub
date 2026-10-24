-- When a password is changed or reset, logins issued before then stop
-- working — e.g. a lost phone is signed out once the password is changed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
