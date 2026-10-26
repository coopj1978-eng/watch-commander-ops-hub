import db from "../db";
import { createNotification } from "../notification/helpers";
import { notifyLineManagers } from "./absenceAccess";
import { addDaysIso, ukInstant, watchShiftOn } from "./shiftRota";

// Back to work interviews (Oct 2026): due on the person's first rostered
// shift back after a sickness. Private like the rest of the sickness record —
// only the person and their own watch's WC/CC are told; never a board card.

const shortDay = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** Their first rostered shift on or after the day they're fit — when the interview is due. */
export async function firstShiftBack(userId: string, fitDateIso: string): Promise<{ due: Date; label: string }> {
  const row = await db.queryRow<{ watch: string | null }>`
    SELECT COALESCE(u.watch_unit, fp.watch) AS watch
    FROM users u LEFT JOIN firefighter_profiles fp ON fp.user_id = u.id
    WHERE u.id = ${userId}
  `;
  const watch = row?.watch;
  if (watch && watchShiftOn(watch, fitDateIso)) {
    for (let i = 0; i < 80; i++) {
      const d = addDaysIso(fitDateIso, i);
      const s = watchShiftOn(watch, d);
      if (s === "1st Day" || s === "2nd Day") return { due: ukInstant(d, 8), label: `${s} ${shortDay(d)}` };
      if (s === "1st Night" || s === "2nd Night") return { due: ukInstant(d, 18), label: `${s} ${shortDay(d)}` };
    }
  }
  return { due: ukInstant(fitDateIso, 8), label: shortDay(fitDateIso) };
}

/** Record the interview as due for this sickness (re-booking just moves it). */
export async function scheduleBackToWorkInterview(absenceId: number, userId: string, fitDateIso: string) {
  const shift = await firstShiftBack(userId, fitDateIso);
  await db.exec`
    INSERT INTO back_to_work_interviews (absence_id, user_id, due_at, shift_label)
    VALUES (${absenceId}, ${userId}, ${shift.due}, ${shift.label})
    ON CONFLICT (absence_id) DO UPDATE SET due_at = EXCLUDED.due_at, shift_label = EXCLUDED.shift_label, reminded_at = NULL
  `;
  return shift;
}

/** Tell the person themself — they hear about their own interview. Never throws. */
export async function notifyPersonOfInterview(userId: string, absenceId: number, message: string) {
  await createNotification({
    user_id: userId,
    type: "sick_booking",
    title: "Back to work interview",
    message,
    entity_type: "absence",
    entity_id: String(absenceId),
    link: "/profile",
  }).catch(() => undefined);
}

/**
 * When someone's first shift back has started, remind their WC/CC and them
 * (once). Runs from the hourly job; never throws.
 */
export async function sendBackToWorkReminders(now: Date = new Date()): Promise<number> {
  const due = await db.rawQueryAll<{ absence_id: number; user_id: string; shift_label: string; name: string | null }>(
    `SELECT b.absence_id, b.user_id, b.shift_label, u.name
     FROM back_to_work_interviews b JOIN users u ON u.id = b.user_id
     WHERE b.done_at IS NULL AND b.reminded_at IS NULL AND b.due_at <= $1`,
    now
  );
  for (const b of due) {
    try {
      await notifyLineManagers(b.user_id, b.user_id, {
        title: "Back to work interview due today",
        message: `${b.name ?? "A member of your watch"} is back today (${b.shift_label}) — a back to work interview needs to be carried out. Record it on their profile when it's done.`,
        absenceId: Number(b.absence_id),
      });
      await notifyPersonOfInterview(b.user_id, Number(b.absence_id),
        `Welcome back. Your back to work interview with your WC or CC is due today (${b.shift_label}).`);
      await db.exec`UPDATE back_to_work_interviews SET reminded_at = NOW() WHERE absence_id = ${b.absence_id}`;
    } catch {
      /* try again next hour */
    }
  }
  return due.length;
}
