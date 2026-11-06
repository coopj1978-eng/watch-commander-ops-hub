-- Weekly routine cards now stay on the board of the watch they came round for,
-- until they're done or that watch's 2nd Night ends (John, Nov 2026). Put back
-- the cards from the tours still running on 6 Nov 2026, which the old rule had
-- already marked Missed at the end of their shift.
UPDATE tasks t
SET status = 'NotStarted', watch_unit = v.watch, due_at = v.due, updated_at = NOW()
FROM (VALUES
  (DATE '2026-11-04', 'Red',  TIMESTAMPTZ '2026-11-08 08:00:00+00'),
  (DATE '2026-11-05', 'Red',  TIMESTAMPTZ '2026-11-08 08:00:00+00'),
  (DATE '2026-11-06', 'Blue', TIMESTAMPTZ '2026-11-10 08:00:00+00')
) AS v(card_date, watch, due),
task_template_instances i,
task_templates tt
WHERE i.task_id = t.id
  AND tt.id = i.template_id
  AND i.generated_for_date = v.card_date
  AND tt.routine_slot IS NOT NULL
  AND tt.routine_slot <> 'every'
  AND COALESCE(tt.routine_rule, 'weekly') = 'weekly'
  AND t.status = 'Missed';
