import { useQuery, type QueryClient } from "@tanstack/react-query";
import backend from "@/lib/backend";

/** Today as YYYY-MM-DD in the user's local (UK) time — not UTC, which is a day behind after midnight in BST. */
export function localTodayIso(d = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Every cached view that shows who's sick, on leave, or their trigger stage.
const ABSENCE_VIEW_KEYS = new Set([
  "absences",
  "wc-absences-today",
  "absences-today-sick",
  "absences-date",
  "my-absences",
  "my-absence-stats",
  "people",
  "profile",
  "wc-profiles",
  "my-profile",
]);

/** Call after any sickness/absence change so the dashboard, People, crewing board and profiles all refresh together. */
export function invalidateAbsenceViews(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: (q) => ABSENCE_VIEW_KEYS.has(String(q.queryKey[0])),
  });
}

/** One row per person: an open sickness wins over a closed one, otherwise the most recent. */
export function latestAbsencePerPerson<
  T extends { firefighter_id: string; start_date: string | Date; returned_to_work_at?: string | Date | null; type?: string },
>(absences: T[]): Map<string, T> {
  const byPerson = new Map<string, T>();
  for (const a of absences) {
    const current = byPerson.get(a.firefighter_id);
    if (!current) {
      byPerson.set(a.firefighter_id, a);
      continue;
    }
    const aOpen = a.type === "sickness" && !a.returned_to_work_at;
    const cOpen = current.type === "sickness" && !current.returned_to_work_at;
    if (aOpen !== cOpen) {
      if (aOpen) byPerson.set(a.firefighter_id, a);
      continue;
    }
    if (new Date(a.start_date) > new Date(current.start_date)) byPerson.set(a.firefighter_id, a);
  }
  return byPerson;
}

/**
 * Ids of everyone off sick on a date. For a WC/CC this is the whole station
 * (names only — no reasons or history), so someone from another watch on
 * your board for a Head for Head shows as sick there too.
 */
export function useSickOn(date: string, enabled = true) {
  return useQuery({
    queryKey: ["absences-today-sick", date],
    queryFn: async () => {
      const r = await backend.absence.todaySick({ date });
      return {
        ids: new Set(r.sick_staff.map((s) => s.user_id)),
        // Open sickness per person, for "Mark fit" by whichever WC/CC takes the call.
        openAbsence: new Map(
          r.sick_staff.filter((s) => s.absence_id != null).map((s) => [s.user_id, s.absence_id as number])
        ),
      };
    },
    enabled,
  });
}

/** Approved absences covering today (open sicknesses included). Shared by every dashboard widget so they agree. */
export function useTodaysAbsences(enabled = true) {
  const today = localTodayIso();
  return useQuery({
    queryKey: ["wc-absences-today", today],
    queryFn: async () =>
      backend.absence.list({ status: "approved", start_date: today, end_date: today, limit: 500 }),
    enabled,
  });
}
