-- Policy acknowledgements — tracks who has formally confirmed they've
-- read and understood a policy document. Partner feature to bulletins
-- (migration 060): a bulletin is a one-off broadcast, a policy is a
-- reference document that needs ongoing compliance. The acknowledgement
-- surface is the same in spirit ("I've read & understood") but the
-- audit trail lives per-doc for good reason — "who's acknowledged the
-- BA Procedure 2024v3" is a direct compliance question.
--
-- Not every policy needs acknowledgement. The `requires_ack` flag on
-- policy_docs (added below) controls whether the acknowledgement prompt
-- is surfaced to readers. Reference material (dictionaries, glossaries)
-- can stay unflagged; safety-critical SOPs flip it on.

ALTER TABLE policy_docs
  ADD COLUMN requires_ack BOOLEAN NOT NULL DEFAULT false;

-- Versioned acks — we record the policy's version string at ack time so
-- that uploading a new version of the same document supersedes prior acks
-- (the old acks still exist as history, but the new version starts
-- unacknowledged). If `version` is NULL on the policy at ack time,
-- we record NULL and treat a NULL-version ack as matching a NULL-version
-- policy only — that keeps the semantics unambiguous.
CREATE TABLE policy_acknowledgements (
  id              SERIAL PRIMARY KEY,
  policy_id       BIGINT NOT NULL REFERENCES policy_docs(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id),
  version         TEXT,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (policy_id, user_id, version)
);

CREATE INDEX idx_policy_acks_policy ON policy_acknowledgements (policy_id);
CREATE INDEX idx_policy_acks_user ON policy_acknowledgements (user_id);
