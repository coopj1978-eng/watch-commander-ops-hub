// Who may see a calendar event — one set of rules for the calendar list and
// the .ics export, so a download never shows more than the page does.

/**
 * The joins the conditions below read: a reminder's note, and the creator
 * (legacy watch events have no `watch` stored, so fall back to the
 * creator's watch).
 */
export const VISIBILITY_JOINS = `
  LEFT JOIN notes n ON ce.id = n.calendar_event_id
  LEFT JOIN users creator ON creator.id = ce.created_by
`;

/**
 * SQL conditions on `ce` (with VISIBILITY_JOINS) for what `callerId` may see,
 * with `watch` as the watch calendar shown. Placeholders start at
 * `$firstParam`; `nextParam` is the next free one.
 */
export function eventVisibility(callerId: string, watch: string | null | undefined, firstParam: number) {
  const conditions: string[] = [];
  const params: string[] = [];
  let paramIndex = firstParam;

  // Reminders (e.g. a note's follow-up, which carries part of the note)
  // are private to whoever wrote them.
  conditions.push(`
      (ce.event_type != 'reminder' OR
       COALESCE(n.created_by_user_id, ce.created_by) = $${paramIndex})
    `);
  params.push(callerId);
  paramIndex++;

  // Watch-calendar events are only visible to that watch. Station-wide and
  // personal events are unaffected. Callers with no watch see all (admin).
  if (watch) {
    conditions.push(
      `(ce.calendar_visibility <> 'watch' OR LOWER(COALESCE(ce.watch, creator.watch_unit, '')) = LOWER($${paramIndex}))`
    );
    params.push(watch);
    paramIndex++;
  }

  // Personal calendars are private: only the owner (or whoever created
  // the entry for them, e.g. a booking logged by their WC).
  conditions.push(
    `(ce.calendar_visibility <> 'personal' OR ce.user_id = $${paramIndex} OR ce.created_by = $${paramIndex})`
  );
  params.push(callerId);
  paramIndex++;

  return { conditions, params, nextParam: paramIndex };
}
