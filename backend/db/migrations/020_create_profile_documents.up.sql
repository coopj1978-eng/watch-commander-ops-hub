CREATE TABLE profile_documents (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES firefighter_profiles(id) ON DELETE CASCADE,
  uploader_user_id TEXT NOT NULL REFERENCES users(id),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  tags TEXT[] DEFAULT '{}',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_file_name_not_empty CHECK (char_length(file_name) > 0),
  CONSTRAINT check_file_size_positive CHECK (file_size > 0)
);

CREATE INDEX idx_profile_documents_profile_id ON profile_documents(profile_id);
CREATE INDEX idx_profile_documents_uploader ON profile_documents(uploader_user_id);
CREATE INDEX idx_profile_documents_uploaded_at ON profile_documents(uploaded_at DESC);
CREATE INDEX idx_profile_documents_tags ON profile_documents USING gin(tags);
