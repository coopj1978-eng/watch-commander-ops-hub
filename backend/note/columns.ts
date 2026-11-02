// The notes columns, named rather than `SELECT *`: pooled connections cache a
// `*` query's result shape, so adding a column (title, Nov 2026) made those
// cached plans fail with "cached plan must not change result type".
export const NOTE_COLUMNS = `id, profile_id, created_by_user_id, title, note_text, next_follow_up_date,
  reminder_enabled, reminder_recipient_user_id, calendar_event_id, attachments, created_at, updated_at`;
