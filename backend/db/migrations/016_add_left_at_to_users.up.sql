ALTER TABLE users
ADD COLUMN left_at TIMESTAMPTZ;

CREATE INDEX idx_users_left_at ON users(left_at);
