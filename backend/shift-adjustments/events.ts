import db from "../db";

/** Shape of a shift_adjustments row as far as event/cascade logic needs it. */
export interface AdjustmentRow {
  id: number;
  user_id: string;
  type: string;
  start_date: Date | string;
  end_date: Date | string;
  covering_user_id?: string | null;
  covering_name?: string | null;
  covering_watch?: string | null;
  shift_day_night?: string | null;
  toil_hours?: number | string | null;
  created_by_user_id: string;
}

/** YYYY-MM-DD for a DATE column value, an ISO string, or a JS Date (UTC day). */
export function toDateOnly(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return (s.includes("T") ? s.split("T")[0] : s).slice(0, 10);
}

/** April-start financial year of a YYYY-MM-DD date (2025 = 2025/26). */
export function financialYearOf(dateOnly: string): number {
  const [y, m] = dateOnly.split("-").map(Number);
  return m >= 4 ? y : y - 1;
}

/**
 * All-day events are anchored at noon UTC: noon is mid-day in every UK
 * offset, so converting to local time can never spill onto a neighbouring
 * calendar day (UTC midnight/end-of-day drew BST events across two days).
 */
function noonUtc(dateOnly: string): Date {
  return new Date(`${dateOnly}T12:00:00.000Z`);
}

/** Drop control chars / line separators that rust-postgres rejects in text params. */
export function sanitiseText(value: string): string {
  return Array.from(value).filter((c) => {
    const code = c.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return false;
    if (code === 0x2028 || code === 0x2029) return false;
    return true;
  }).join("");
}

export function spentReasonFor(coveringName: string | null | undefined): string {
  return "TOIL shift - covered by " + sanitiseText(String(coveringName || "cover"));
}

async function insertEvent(e: {
  title: string;
  eventType: string;
  visibility: string;
  start: Date;
  end: Date;
  userId: string;
  isWatchEvent: boolean;
  watch: string | null;
  createdBy: string;
  adjId: number;
}): Promise<void> {
  await db.exec`
    INSERT INTO calendar_events (
      title, event_type, calendar_visibility, start_time, end_time,
      all_day, user_id, is_watch_event, watch, created_by, shift_adjustment_id
    ) VALUES (
      ${e.title}, ${e.eventType}, ${e.visibility}, ${e.start}, ${e.end},
      true, ${e.userId}, ${e.isWatchEvent}, ${e.watch}, ${e.createdBy}, ${e.adjId}
    )
  `;
}

/**
 * Writes the calendar events for an adjustment, every one linked by
 * shift_adjustment_id so edits and deletes can find them again.
 * `owner` is the absent/working person; `watchUnit` is the adjustment's watch.
 */
export async function insertAdjustmentEvents(
  adj: AdjustmentRow,
  owner: { name: string; watch_unit: string }
): Promise<void> {
  const startOnly = toDateOnly(adj.start_date);
  // Night shifts collapse to the start day — the "night of the 25th"
  // belongs to one calendar day even though it runs into the 26th.
  const endOnly = adj.shift_day_night === "Night" ? startOnly : toDateOnly(adj.end_date);
  const start = noonUtc(startOnly);
  const end = noonUtc(endOnly);

  const shiftSuffix = adj.shift_day_night ? ` · ${adj.shift_day_night} Shift` : "";
  const hours = adj.toil_hours != null ? Number(adj.toil_hours) : null;
  const cover = adj.covering_name || "cover";
  const base = {
    start,
    end,
    createdBy: adj.created_by_user_id,
    adjId: adj.id,
  };

  if (adj.type === "flexi_payback") {
    const shiftLabel = adj.shift_day_night ?? "Day";
    await insertEvent({
      ...base,
      title: `${owner.name} – Flexi Payback (${shiftLabel} Shift)`,
      eventType: "personal",
      visibility: "watch",
      userId: adj.user_id,
      isWatchEvent: true,
      watch: adj.covering_watch ?? null,
    });
    return;
  }

  if (adj.type === "orange_day") {
    const shiftLabel = adj.shift_day_night ?? "Day";
    await insertEvent({
      ...base,
      title: `Orange Day (${shiftLabel} Shift)`,
      eventType: "personal",
      visibility: "personal",
      userId: adj.user_id,
      isWatchEvent: false,
      watch: owner.watch_unit,
    });
    await insertEvent({
      ...base,
      title: `${owner.name} – Orange Day (${shiftLabel} Shift)`,
      eventType: "personal",
      visibility: "watch",
      userId: adj.user_id,
      isWatchEvent: true,
      watch: owner.watch_unit,
    });
    return;
  }

  // Outbound: the person is away from their own watch.
  const typeLabel =
    adj.type === "flexi"    ? "Flexi Day" :
    adj.type === "training" ? "Training"  :
    adj.type === "toil"     ? `TOIL (${hours}hrs)` : "Head for Head";
  const eventType = adj.type === "training" ? "training" : "personal";

  await insertEvent({
    ...base,
    title:
      adj.type === "h4h"  ? `H4H – Off${shiftSuffix} (covered by ${cover})` :
      adj.type === "toil" ? `TOIL – Off ${hours}hrs${shiftSuffix} (covered by ${cover})` :
      typeLabel,
    eventType,
    visibility: "personal",
    userId: adj.user_id,
    isWatchEvent: false,
    watch: owner.watch_unit,
  });

  await insertEvent({
    ...base,
    title:
      adj.type === "h4h"  ? `${owner.name} – H4H${shiftSuffix} (covered by ${cover})` :
      adj.type === "toil" ? `${owner.name} – TOIL ${hours}hrs${shiftSuffix} (covered by ${cover})` :
      `${owner.name} – ${typeLabel}`,
    eventType,
    visibility: "watch",
    userId: adj.user_id,
    isWatchEvent: true,
    watch: owner.watch_unit,
  });

  if ((adj.type === "h4h" || adj.type === "toil") && adj.covering_user_id) {
    await insertEvent({
      ...base,
      title:
        adj.type === "toil"
          ? `TOIL – Covering for ${owner.name} (${owner.watch_unit} Watch)${shiftSuffix} — ${hours}hrs`
          : `H4H – Covering for ${owner.name} (${owner.watch_unit} Watch)${shiftSuffix}`,
      eventType: "personal",
      visibility: "personal",
      userId: adj.covering_user_id,
      isWatchEvent: false,
      watch: owner.watch_unit,
    });
  }
}

/**
 * Removes every calendar event belonging to an adjustment: linked rows by
 * shift_adjustment_id, plus pre-migration-062 events matched by their old
 * midnight/end-of-day anchors.
 */
export async function deleteAdjustmentEvents(adj: AdjustmentRow): Promise<void> {
  await db.exec`DELETE FROM calendar_events WHERE shift_adjustment_id = ${adj.id}`;

  const legacyStart = `${toDateOnly(adj.start_date)}T00:00:00.000Z`;
  const legacyEnd = `${toDateOnly(adj.end_date)}T23:59:59.999Z`;

  await db.exec`
    DELETE FROM calendar_events
    WHERE shift_adjustment_id IS NULL
      AND all_day = true
      AND start_time = ${legacyStart}::timestamptz
      AND end_time = ${legacyEnd}::timestamptz
      AND (user_id = ${adj.user_id} OR created_by = ${adj.user_id})
  `;

  if ((adj.type === "h4h" || adj.type === "toil") && adj.covering_user_id) {
    await db.exec`
      DELETE FROM calendar_events
      WHERE shift_adjustment_id IS NULL
        AND all_day = true
        AND start_time = ${legacyStart}::timestamptz
        AND end_time = ${legacyEnd}::timestamptz
        AND user_id = ${adj.covering_user_id}
    `;
  }
}

/**
 * Full delete of an adjustment and everything hanging off it: refunds TOIL
 * (spent ledger row), unwinds H4H debts/settlements, removes calendar
 * events, then the adjustment itself.
 */
export async function cascadeDeleteAdjustment(adj: AdjustmentRow): Promise<void> {
  if (adj.type === "toil") {
    await db.exec`
      DELETE FROM toil_ledger
      WHERE shift_adjustment_id = ${adj.id} AND type = 'spent'
    `;
  }

  if (adj.type === "h4h") {
    // Pending debts created by this adjustment go; settled ones keep their
    // record (FK is ON DELETE SET NULL).
    await db.exec`
      DELETE FROM h4h_ledger
      WHERE shift_adjustment_id = ${adj.id} AND status = 'pending'
    `;
    // If this adjustment was the payback for a debt, that debt is owed again.
    await db.exec`
      UPDATE h4h_ledger SET
        status = 'pending',
        settled_at = NULL,
        settled_by_user_id = NULL,
        settled_via = NULL,
        payback_shift_adjustment_id = NULL,
        updated_at = NOW()
      WHERE payback_shift_adjustment_id = ${adj.id} AND status = 'settled'
    `;
  }

  await deleteAdjustmentEvents(adj);
  await db.exec`DELETE FROM shift_adjustments WHERE id = ${adj.id}`;
}

export async function loadAdjustment(id: number): Promise<(AdjustmentRow & { watch_unit: string }) | null> {
  return db.queryRow<AdjustmentRow & { watch_unit: string }>`
    SELECT id, user_id, type, start_date, end_date, covering_user_id, covering_name,
           covering_watch, shift_day_night, toil_hours, created_by_user_id, watch_unit
    FROM shift_adjustments WHERE id = ${id}
  `;
}
