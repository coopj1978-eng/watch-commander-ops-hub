-- Allow external attendees (firefighters from other watches/stations) to be
-- logged on training sessions. External attendees don't have a user row in
-- this system, so we capture their name + rank + originating watch/station
-- as free text and make user_id nullable.

ALTER TABLE training_attendance ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE training_attendance
  ADD COLUMN IF NOT EXISTS external_name    TEXT,
  ADD COLUMN IF NOT EXISTS external_rank    TEXT,
  ADD COLUMN IF NOT EXISTS external_station TEXT;

-- Either user_id OR external_name must be set (but not neither).
ALTER TABLE training_attendance DROP CONSTRAINT IF EXISTS training_attendance_identity_check;
ALTER TABLE training_attendance ADD CONSTRAINT training_attendance_identity_check
  CHECK (user_id IS NOT NULL OR external_name IS NOT NULL);

-- The old UNIQUE(training_id, user_id) still prevents duplicate internal attendees.
-- For external attendees, PostgreSQL treats multiple rows with user_id=NULL as
-- distinct (NULL is never equal to NULL), so external entries can repeat — that's
-- actually what we want (two different people from two different watches could
-- have the same rank/first-name).
