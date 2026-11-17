// People opens on the filters you last left it on (John, 17 Nov 2026). Kept
// on the device, per person, so two commanders sharing the office computer
// each get their own. A link that carries filters of its own still wins.

export interface PeopleFilters {
  status: "all" | "active" | "inactive";
  watch: string[];
  rank: string[];
  skills: string[];
  driverPathway: string;
  station: string;
  sortBy: string;
  sortDir: "asc" | "desc";
}

export const DEFAULT_PEOPLE_FILTERS: PeopleFilters = {
  status: "all", watch: [], rank: [], skills: [], driverPathway: "", station: "", sortBy: "watch", sortDir: "asc",
};

const FILTER_PARAMS = ["status", "watch", "rank", "skills", "driverPathway", "station", "sortBy", "sortDir"];
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x !== "") : []);
const text = (v: unknown): string => (typeof v === "string" ? v : "");

export const peopleFiltersKey = (userId: string | undefined) => `people-filters:${userId ?? "anon"}`;

/** What was saved, tidied — anything missing or odd falls back to the default. */
export function parseSavedFilters(raw: string | null | undefined): PeopleFilters | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return null;
    return {
      status: o.status === "active" || o.status === "inactive" ? o.status : "all",
      watch: list(o.watch), rank: list(o.rank), skills: list(o.skills),
      driverPathway: text(o.driverPathway), station: text(o.station),
      sortBy: text(o.sortBy) || "watch",
      sortDir: o.sortDir === "desc" ? "desc" : "asc",
    };
  } catch {
    return null;
  }
}

/** The filters in a link ("/people?watch=Blue"), or null when it carries none. */
export function filtersFromUrl(params: URLSearchParams): PeopleFilters | null {
  if (!FILTER_PARAMS.some((k) => params.has(k))) return null;
  const many = (k: string) => (params.get(k) ?? "").split(",").filter(Boolean);
  const status = params.get("status");
  return {
    status: status === "active" || status === "inactive" ? status : "all",
    watch: many("watch"), rank: many("rank"), skills: many("skills"),
    driverPathway: params.get("driverPathway") ?? "", station: params.get("station") ?? "",
    sortBy: params.get("sortBy") || "watch",
    sortDir: params.get("sortDir") === "desc" ? "desc" : "asc",
  };
}

/** A link's own filters first, then what this person last left, then the default. */
export function openingFilters(params: URLSearchParams, saved: string | null | undefined): PeopleFilters {
  return filtersFromUrl(params) ?? parseSavedFilters(saved) ?? DEFAULT_PEOPLE_FILTERS;
}
