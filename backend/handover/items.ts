import { api, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { shiftSlot, slotAfter, ukParts, watchForSlot } from "../lib/shiftRota";
import type { Handover, HandoverItem, ShiftType } from "./types";

// Handover items (Oct 2026) — see types.ts. "action" items are station cards
// on the shift board (tasks.source_type = 'handover', no watch) so whoever is
// on duty sees them until someone does them; "info" items show on the next
// watch's board until they mark the handover read, or to every watch until
// show_until.

const isoDate = (d: Date | string) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
const isoTime = (d: Date | string | null | undefined) => (d == null ? undefined : d instanceof Date ? d.toISOString() : String(d));

/** The shift after a handover's shift, and the watch working it. */
export function nextShiftFor(shiftDate: string, shiftType: ShiftType) {
  const slot = slotAfter(shiftSlot(shiftDate, shiftType === "Night" ? "night" : "day"));
  return { slot, watch: watchForSlot(slot)?.watch ?? null };
}

interface HandoverRef { id: number; watch: string; shift_type: ShiftType; shift_date: string }

/** Make a handover's items match `items`: add, change and remove — keeping their board cards in step. */
export async function saveHandoverItems(h: HandoverRef, items: HandoverItem[] | undefined, userId: string): Promise<void> {
  const wanted = (items ?? [])
    .map((i) => ({ ...i, text: (i.text ?? "").trim() }))
    .filter((i) => i.text && (i.kind === "action" || i.kind === "info"));
  const existing = await db.rawQueryAll<{ id: number; task_id: number | null }>(
    `SELECT id, task_id FROM handover_items WHERE handover_id = $1`, h.id
  );
  const due = nextShiftFor(h.shift_date, h.shift_type).slot.start;
  const label = `Handover from ${h.watch} Watch · ${h.shift_type} ${h.shift_date}`;

  // Removed lines: their open card goes too (a finished one stays on record).
  const keep = new Set(wanted.filter((w) => w.id).map((w) => Number(w.id)));
  for (const e of existing) {
    if (keep.has(Number(e.id))) continue;
    if (e.task_id) await db.rawExec(`DELETE FROM tasks WHERE id = $1 AND status <> 'Done'`, e.task_id);
    await db.rawExec(`DELETE FROM handover_items WHERE id = $1`, e.id);
  }

  let position = 0;
  for (const w of wanted) {
    const prev = w.id ? existing.find((e) => Number(e.id) === Number(w.id)) : undefined;
    let taskId = prev?.task_id ?? null;
    if (w.kind === "action") {
      if (taskId) {
        await db.rawExec(`UPDATE tasks SET title = $1, updated_at = NOW() WHERE id = $2 AND status <> 'Done'`, w.text, taskId);
      } else {
        const task = await db.rawQueryRow<{ id: number }>(
          `INSERT INTO tasks (title, description, category, assigned_by, priority, status, watch_unit, source_type, due_at)
           VALUES ($1, $2, 'Other', $3, 'Med', 'NotStarted', NULL, 'handover', $4)
           RETURNING id`,
          w.text, label, userId, due
        );
        taskId = task?.id ?? null;
      }
    } else if (taskId) {
      await db.rawExec(`DELETE FROM tasks WHERE id = $1 AND status <> 'Done'`, taskId);
      taskId = null;
    }
    const showUntil = w.kind === "info" && w.show_until ? w.show_until : null;
    const tag = w.tag?.trim() || null;
    if (prev) {
      await db.rawExec(
        `UPDATE handover_items SET kind = $1, tag = $2, text = $3, show_until = $4::date, task_id = $5, position = $6 WHERE id = $7`,
        w.kind, tag, w.text, showUntil, taskId, position, prev.id
      );
    } else {
      await db.rawExec(
        `INSERT INTO handover_items (handover_id, kind, tag, text, show_until, task_id, position)
         VALUES ($1, $2, $3, $4, $5::date, $6, $7)`,
        h.id, w.kind, tag, w.text, showUntil, taskId, position
      );
    }
    position++;
  }
}

async function loadItems(ids: number[]): Promise<Map<number, HandoverItem[]>> {
  const map = new Map<number, HandoverItem[]>();
  if (ids.length === 0) return map;
  const rows = await db.rawQueryAll<any>(
    `SELECT i.id, i.handover_id, i.kind, i.tag, i.text, i.show_until, i.task_id,
            t.status AS task_status, t.completed_at, u.name AS done_by_name
     FROM handover_items i
     LEFT JOIN tasks t ON t.id = i.task_id
     LEFT JOIN users u ON u.id = t.completed_by
     WHERE i.handover_id = ANY($1::bigint[])
     ORDER BY i.position, i.id`,
    ids
  );
  for (const r of rows) {
    const list = map.get(Number(r.handover_id)) ?? [];
    list.push({
      id: Number(r.id), kind: r.kind, tag: r.tag ?? undefined, text: r.text,
      show_until: r.show_until ? isoDate(r.show_until) : undefined,
      task_id: r.task_id ?? undefined, task_status: r.task_status ?? undefined,
      done_by_name: r.task_status === "Done" ? r.done_by_name ?? undefined : undefined,
      done_at: r.task_status === "Done" ? isoTime(r.completed_at) : undefined,
    });
    map.set(Number(r.handover_id), list);
  }
  return map;
}

/** Handovers with their items and read status. `where` uses $1… for `params`. */
export async function loadHandovers(where: string, params: (string | number)[], limit = 20, offset = 0): Promise<{ handovers: Handover[]; total: number }> {
  const n = params.length;
  const rows = await db.rawQueryAll<any>(
    `SELECT h.id, h.watch, h.shift_type, h.shift_date, h.written_by_user_id, h.incidents, h.outstanding_tasks,
            h.equipment_notes, h.staff_notes, h.general_notes, h.created_at, h.updated_at, h.next_watch,
            u.name AS author_name, r.read_at, ru.name AS read_by_name, COUNT(*) OVER() AS total
     FROM handovers h
     LEFT JOIN users u ON u.id = h.written_by_user_id
     LEFT JOIN handover_reads r ON r.handover_id = h.id AND LOWER(r.watch) = LOWER(h.next_watch)
     LEFT JOIN users ru ON ru.id = r.read_by
     ${where}
     ORDER BY h.shift_date DESC, h.created_at DESC
     LIMIT $${n + 1} OFFSET $${n + 2}`,
    ...params, limit, offset
  );
  const items = await loadItems(rows.map((r) => Number(r.id)));
  return {
    total: rows.length ? Number(rows[0].total) : 0,
    handovers: rows.map((r) => ({
      id: Number(r.id), watch: r.watch, shift_type: r.shift_type, shift_date: isoDate(r.shift_date),
      written_by_user_id: r.written_by_user_id, written_by_name: r.author_name ?? undefined,
      incidents: r.incidents ?? undefined, outstanding_tasks: r.outstanding_tasks ?? undefined,
      equipment_notes: r.equipment_notes ?? undefined, staff_notes: r.staff_notes ?? undefined,
      general_notes: r.general_notes ?? "", created_at: isoTime(r.created_at)!, updated_at: isoTime(r.updated_at)!,
      items: items.get(Number(r.id)) ?? [], next_watch: r.next_watch ?? undefined,
      read_by_name: r.read_by_name ?? undefined, read_at: isoTime(r.read_at),
    })),
  };
}

// ─── Board notes: the info lines a watch should see on its board ─────────────

export interface BoardNote {
  handover_id: number;
  from_watch: string;
  shift_type: string;
  shift_date: string;
  written_by_name?: string;
  /** Not yet marked read by this watch (it's the watch the handover is for). */
  unread: boolean;
  items: HandoverItem[];
}

export const boardNotes = api<{ watch: Query<string> }, { notes: BoardNote[] }>(
  { auth: true, expose: true, method: "GET", path: "/handovers/notes" },
  async ({ watch }) => {
    const today = ukParts().date;
    const rows = await db.rawQueryAll<any>(
      `SELECT h.id AS handover_id, h.watch, h.shift_type, h.shift_date, u.name AS author_name,
              i.id, i.tag, i.text, i.show_until,
              (LOWER(COALESCE(h.next_watch, '')) = LOWER($1) AND rd.handover_id IS NULL) AS unread
       FROM handover_items i
       JOIN handovers h ON h.id = i.handover_id
       LEFT JOIN users u ON u.id = h.written_by_user_id
       LEFT JOIN handover_reads rd ON rd.handover_id = h.id AND LOWER(rd.watch) = LOWER($1)
       WHERE i.kind = 'info' AND (
         (LOWER(COALESCE(h.next_watch, '')) = LOWER($1) AND rd.handover_id IS NULL AND h.created_at > NOW() - INTERVAL '14 days')
         OR (i.show_until IS NOT NULL AND i.show_until >= $2::date)
       )
       ORDER BY h.shift_date DESC, h.created_at DESC, i.position, i.id`,
      watch, today
    );
    const notes: BoardNote[] = [];
    for (const r of rows) {
      let note = notes.find((x) => x.handover_id === Number(r.handover_id));
      if (!note) {
        note = {
          handover_id: Number(r.handover_id), from_watch: r.watch, shift_type: r.shift_type,
          shift_date: isoDate(r.shift_date), written_by_name: r.author_name ?? undefined, unread: !!r.unread, items: [],
        };
        notes.push(note);
      }
      note.items.push({ id: Number(r.id), kind: "info", tag: r.tag ?? undefined, text: r.text, show_until: r.show_until ? isoDate(r.show_until) : undefined });
    }
    return { notes };
  }
);

export const markRead = api<{ id: number; watch: string }, { ok: boolean }>(
  { auth: true, expose: true, method: "POST", path: "/handovers/:id/read" },
  async ({ id, watch }) => {
    const auth = getAuthData()!;
    await db.rawExec(
      `INSERT INTO handover_reads (handover_id, watch, read_by) VALUES ($1, $2, $3)
       ON CONFLICT (handover_id, watch) DO NOTHING`,
      id, watch, auth.userID
    );
    return { ok: true };
  }
);
