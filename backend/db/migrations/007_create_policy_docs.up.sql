CREATE TABLE policy_docs (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT,
  version TEXT,
  file_url TEXT NOT NULL,
  vector_id TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  review_date DATE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  tags TEXT[],
  effective_date DATE,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  total_pages INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_policy_docs_category ON policy_docs(category);
CREATE INDEX idx_policy_docs_uploaded_by ON policy_docs(uploaded_by);
CREATE INDEX idx_policy_docs_uploaded_at ON policy_docs(uploaded_at);
CREATE INDEX idx_policy_docs_vector_id ON policy_docs(vector_id);
