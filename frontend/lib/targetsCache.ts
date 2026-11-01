import type { QueryClient } from "@tanstack/react-query";

// Every query that shows target progress: the Targets page cards and Year at
// a Glance, the inspection lists, and the dashboard tiles. Queries are cached
// for 5 minutes, so ticking an HFSV or an inspection in one place used to
// leave the others showing the old count. Call this after any change to
// activity records or inspection assignments.
const TARGET_QUERY_ROOTS = new Set([
  "activities", "activities-q", "activity", "hfsv", "hfsv-pending", "hfsv-slot",
  "assignments", "ms-assignments-q", "inspection-assignments", "inspection-assignments-pending",
  "targets", "wc-targets", "wc-hfsv", "wc-community", "wc-multistory", "wc-hydrant", "hydrants",
]);

export function invalidateTargetViews(qc: QueryClient) {
  return qc.invalidateQueries({ predicate: (q) => TARGET_QUERY_ROOTS.has(String(q.queryKey[0])) });
}
