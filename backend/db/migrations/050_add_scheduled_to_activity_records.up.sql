-- Track whether an HFSV slot has been scheduled on the calendar (but not yet completed).
-- Prevents duplicate bookings of the same slot.
ALTER TABLE activity_records ADD COLUMN IF NOT EXISTS scheduled BOOLEAN NOT NULL DEFAULT FALSE;
