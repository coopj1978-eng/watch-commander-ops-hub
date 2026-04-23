import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";

interface MarkReadRequest {
  id: number;
}

interface MarkReadResponse {
  ok: true;
  read_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /bulletins/:id/read
//
// Mark a bulletin as read for the current user. Idempotent — repeated calls
// do not create duplicate rows (UNIQUE constraint on (bulletin_id, user_id)).
// Does NOT set acknowledged_at even if the bulletin requires_ack — use the
// separate /acknowledge endpoint for that explicit step.
// ─────────────────────────────────────────────────────────────────────────────
export const markRead = api<MarkReadRequest, MarkReadResponse>(
  { auth: true, expose: true, method: "POST", path: "/bulletins/:id/read" },
  async (req) => {
    const auth = getAuthData()!;

    // Verify the bulletin exists before creating a read row so we don't
    // silently accumulate reads pointing at deleted or non-existent ids.
    const exists = await db.queryRow<{ id: number }>`
      SELECT id FROM bulletins WHERE id = ${req.id}
    `;
    if (!exists) {
      throw APIError.notFound("bulletin not found");
    }

    const row = await db.queryRow<{ read_at: Date }>`
      INSERT INTO bulletin_reads (bulletin_id, user_id)
      VALUES (${req.id}, ${auth.userID})
      ON CONFLICT (bulletin_id, user_id) DO UPDATE
        SET read_at = bulletin_reads.read_at  -- keep original read_at
      RETURNING read_at
    `;

    return {
      ok: true,
      read_at: (row?.read_at ?? new Date()).toISOString(),
    };
  }
);
