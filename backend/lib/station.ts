// This hub is one station's. Its watches — the crewing board, the rotas,
// staffing counts, who is a watch's WC/CC — are made up of the people at
// this station. Someone recorded at another station (they've moved, or
// they're kept for cover) keeps their record but is not on a watch here.
// (John, 18 Nov 2026: he moved a person to another station and they were
// still on the crewing board.)

/** The station this hub belongs to. */
export const HOME_STATION = "B10 Springburn";

/** At this station? A record with no station on it counts as here. */
export function atHomeStation(station: string | null | undefined): boolean {
  const s = (station ?? "").trim();
  return s === "" || s === HOME_STATION;
}

/**
 * The same test in SQL, for a query that has firefighter_profiles joined
 * as `alias` (a LEFT JOIN is fine: no profile counts as here).
 */
export const atHomeStationSql = (alias: string): string =>
  `(COALESCE(NULLIF(TRIM(${alias}.station), ''), '${HOME_STATION}') = '${HOME_STATION}')`;
