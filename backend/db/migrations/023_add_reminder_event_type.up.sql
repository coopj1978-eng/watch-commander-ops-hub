ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_event_type_check;

ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_event_type_check 
  CHECK (event_type IN ('watch', 'personal', 'training', 'meeting', 'inspection', 'maintenance', 'reminder'));
