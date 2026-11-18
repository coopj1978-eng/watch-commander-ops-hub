// This hub is one station's. Its watches — the crewing board, the rotas,
// staffing counts, who is a watch's WC/CC — are made up of the people at
// this station. Two kinds of account keep their record but are not on a
// watch here:
//   • someone recorded at another station (they've moved, or they're kept
//     for cover) — John, 18 Nov 2026: he moved a person to another station
//     and they were still on the crewing board;
//   • an admin-only account (rank "Admin") — it runs the hub and can see
//     and change every watch, but it isn't crew and isn't counted in the
//     numbers (John, 18 Nov 2026).

/** The station this hub belongs to. */
export const HOME_STATION = "B10 Springburn";

/** The rank of an admin-only account. It has a Watch Commander's rights. */
export const ADMIN_RANK = "Admin";

/** At this station? A record with no station on it counts as here. */
export function atHomeStation(station: string | null | undefined): boolean {
  const s = (station ?? "").trim();
  return s === "" || s === HOME_STATION;
}

/** Counted on a watch here: at this station, and not an admin-only account. */
export function onWatchHere(station: string | null | undefined, rank: string | null | undefined): boolean {
  return atHomeStation(station) && (rank ?? "").trim() !== ADMIN_RANK;
}

/**
 * The same test in SQL, for a query that has firefighter_profiles joined
 * as `alias` (a LEFT JOIN is fine: no profile counts as here). Every "who
 * is on this watch" query uses it.
 */
export const onWatchHereSql = (alias: string): string =>
  `(COALESCE(NULLIF(TRIM(${alias}.station), ''), '${HOME_STATION}') = '${HOME_STATION}'` +
  ` AND COALESCE(${alias}.rank, '') <> '${ADMIN_RANK}')`;
