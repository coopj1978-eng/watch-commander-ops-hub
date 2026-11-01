import { useQuery } from "@tanstack/react-query";
import backend from "@/lib/backend";
import { getWatchShiftStatus } from "@/lib/shiftRota";
import { REFERENCE_WATCHES, referenceHolders } from "@/lib/referenceRota";

// The station references' wording (from the server; WCs/CCs edit it on the
// References page) and who covers a reference right now.

export function useReferences() {
  return useQuery({
    queryKey: ["references"],
    queryFn: async () => (await backend.references.listReferences()).references,
    staleTime: 10 * 60_000,
  });
}

/** The watch on duty now, by the rota. */
export function watchOnDutyNow(now: Date = new Date()): string | null {
  return REFERENCE_WATCHES.find((w) => getWatchShiftStatus(w, now)?.state === "on") ?? null;
}

/**
 * Who has a reference this shift: its main watch when they're on, the
 * secondary watch when they're on instead (John: the secondary covers it
 * when the main watch is off), otherwise neither is on duty.
 */
export function coverNow(ref: number, now: Date = new Date()): { watch: string | null; as: "main" | "secondary" | null } {
  const { main, secondary } = referenceHolders(ref, now.getFullYear());
  const on = watchOnDutyNow(now);
  if (on === main) return { watch: main, as: "main" };
  if (on === secondary) return { watch: secondary, as: "secondary" };
  return { watch: null, as: null };
}
