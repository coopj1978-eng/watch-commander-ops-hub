-- Bulletins — one-way WC/CC broadcast with read receipts.
--
-- Purpose: close the "I need everyone on my watch to have seen this, and I
-- need a record of it" gap. Tasks are the wrong tool (actionable), handovers
-- are shift-scoped, policies are reference material. Bulletins sit between
-- the three: an information item with an audience and optional
-- acknowledgement requirement.
--
-- Scope model:
--   • "watch" scope — visible to one named watch (White/Red/Blue/Green/Amber)
--   • "station" scope — visible to everyone at the station (all watches)
-- The posting user's own role gates which scope they can pick (CC limited to
-- their own watch; WC can post station-wide) — enforced in the API layer.
CREATE TABLE bulletins (
  id             SERIAL PRIMARY KEY,
  posted_by      TEXT NOT NULL REFERENCES users(id),
  scope          TEXT NOT NULL CHECK (scope IN ('watch', 'station')),
  -- For scope='watch', this is the watch name. For scope='station', NULL.
  watch_unit     TEXT,
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  -- Routine / important / urgent — drives colour + badge on dashboard.
  priority       TEXT NOT NULL DEFAULT 'routine'
                 CHECK (priority IN ('routine', 'important', 'urgent')),
  -- When true, every recipient must explicitly acknowledge (not just be
  -- counted as having seen it). Used for SOPs + safety-critical items.
  requires_ack   BOOLEAN NOT NULL DEFAULT false,
  -- Hide from the FF dashboard after this date. NULL = never expires.
  -- WC can still see the full history on /bulletins.
  expires_at     TIMESTAMP,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Per-user read / acknowledgement receipts. A row exists once a user has
-- seen the bulletin (at minimum). If the bulletin `requires_ack`,
-- acknowledged_at must also be populated before the user is considered
-- compliant.
CREATE TABLE bulletin_reads (
  id              SERIAL PRIMARY KEY,
  bulletin_id     INTEGER NOT NULL REFERENCES bulletins(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id),
  read_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  UNIQUE (bulletin_id, user_id)
);

-- Common access patterns:
--   • List visible bulletins for a user (by their watch + station scope)
--   • Compute read/ack stats per bulletin for WC dashboard
CREATE INDEX idx_bulletins_scope_watch ON bulletins (scope, watch_unit);
CREATE INDEX idx_bulletins_created_at ON bulletins (created_at DESC);
CREATE INDEX idx_bulletin_reads_bulletin ON bulletin_reads (bulletin_id);
CREATE INDEX idx_bulletin_reads_user ON bulletin_reads (user_id);
