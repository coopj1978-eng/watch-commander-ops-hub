// The J4 board (John, Nov 2026): the whiteboard in the office, in the app.
// One column per appliance, and on each line the date, the item, a J7 tick,
// remarks and the watch that put it up. A line stays on the board until it's
// cleared; "Ordered" means a replacement or repair is on its way.

export interface BoardDefect {
  id: number;
  defect_type: string;
  appliance_id: number | null;
  equipment_item_id: number | null;
  appliance_call_sign: string;
  equipment_name: string;
  title: string | null;
  description: string;
  location: string | null;
  status: string;
  j7_raised: boolean;
  watch: string | null;
  reported_at: string;
  reported_by_name: string;
  overdue: boolean;
}

export interface BoardLine {
  id: number;
  item: string;
  remarks: string;
  status: "Open" | "Ordered" | "Resolved";
  j7: boolean;
  watch: string | null;
  date: string;
  reportedBy: string;
  overdue: boolean;
}

export interface BoardGroup {
  /** Appliance id, or "station". */
  key: string;
  heading: string;
  sub: string;
  lines: BoardLine[];
}

const clean = (s: string | null | undefined) => (s ?? "").trim();

/** What the line is about, and what's wrong with it — as the board's Item and Remarks. */
export function boardLine(d: BoardDefect): BoardLine {
  const title = clean(d.title);
  const detail = clean(d.description);
  let item: string;
  let remarks: string;
  if (d.defect_type === "equipment") {
    // Kit from the appliance's list: the kit is the item, the rest is remarks.
    item = clean(d.equipment_name) || title || "Equipment";
    remarks = [title && title !== item ? title : "", detail].filter(Boolean).join(". ");
  } else if (d.defect_type === "station") {
    const where = clean(d.location);
    item = title || where || "Station";
    remarks = [where && where !== item ? where : "", detail].filter(Boolean).join(". ");
  } else {
    item = title || "Appliance";
    remarks = detail;
  }
  return {
    id: d.id,
    item,
    remarks,
    status: d.status === "Ordered" ? "Ordered" : d.status === "Resolved" ? "Resolved" : "Open",
    j7: !!d.j7_raised,
    watch: clean(d.watch) || null,
    date: d.reported_at,
    reportedBy: d.reported_by_name,
    overdue: d.overdue,
  };
}

/** Still on the board: not cleared. */
export const outstanding = (d: { status: string }) => d.status !== "Resolved";

/**
 * The board: every appliance in call-sign order (an empty column still shows,
 * as it does in the office), then the station if it has anything. Oldest line
 * first within a column, the way a whiteboard fills up.
 */
export function boardGroups(
  appliances: { id: number; call_sign: string; name: string }[],
  defects: BoardDefect[],
): BoardGroup[] {
  const byDate = (a: BoardDefect, b: BoardDefect) => a.reported_at.localeCompare(b.reported_at) || a.id - b.id;
  const groups: BoardGroup[] = appliances
    .slice()
    .sort((a, b) => a.call_sign.localeCompare(b.call_sign))
    .map((a) => ({
      key: String(a.id),
      heading: a.call_sign,
      sub: a.name,
      lines: defects.filter((d) => d.appliance_id === a.id).sort(byDate).map(boardLine),
    }));
  // Lines for an appliance that's no longer listed keep their own column.
  const known = new Set(appliances.map((a) => a.id));
  const orphans = defects.filter((d) => d.appliance_id !== null && !known.has(d.appliance_id));
  for (const callSign of [...new Set(orphans.map((d) => d.appliance_call_sign || "Other"))].sort()) {
    groups.push({
      key: `old-${callSign}`,
      heading: callSign,
      sub: "No longer listed",
      lines: orphans.filter((d) => (d.appliance_call_sign || "Other") === callSign).sort(byDate).map(boardLine),
    });
  }
  const station = defects.filter((d) => d.appliance_id === null).sort(byDate).map(boardLine);
  if (station.length) groups.push({ key: "station", heading: "Station", sub: "Building and bays", lines: station });
  return groups;
}

/** "3 on B10P1 · 2 on B10P2" — the one-line summary above the tabs. */
export function boardSummary(groups: BoardGroup[]): string {
  return groups
    .filter((g) => g.lines.length > 0)
    .map((g) => `${g.lines.length} on ${g.heading === "Station" ? "the station" : g.heading}`)
    .join(" · ");
}
