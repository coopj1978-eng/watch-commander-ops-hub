-- Allow 'training' as a source_type on calendar_events so planned training
-- sessions can be surfaced on the calendar alongside inspections, linked back
-- to the originating training_records row via source_id.
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_source_type_check;
ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_source_type_check
  CHECK (source_type IS NULL OR source_type IN ('hfsv','hydrant','multistory','operational','care_home','training'));
