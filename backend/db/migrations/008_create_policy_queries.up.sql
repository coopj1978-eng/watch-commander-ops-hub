CREATE TABLE policy_queries (
  id BIGSERIAL PRIMARY KEY,
  asked_by_user_id TEXT NOT NULL REFERENCES users(id),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  citations JSONB NOT NULL,
  confidence NUMERIC(3,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_policy_queries_user_id ON policy_queries(asked_by_user_id);
CREATE INDEX idx_policy_queries_created_at ON policy_queries(created_at);
