import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";

interface AcknowledgeRequest {
  id: number;
}

interface AcknowledgeResponse {
  ok: true;
  acknowledged_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /bulletins/:id/acknowledge
//
// Explicit acknowledgement that the current user has read and understood a
// bulletin that requires_ack. Also implicitly marks it as read if not
// already. Idempotent — re-acknowledging keeps the original timestamp.
//
// Why separate from markRead? We want a clear audit trail: "read" means
// "appeared in their feed", "acknowledged" means "they actively confirmed
// they've understood it". Some bulletins (policy updates, safety alerts)
// need the stronger guarantee.
// ─────────────────────────────────────────────────────────────────────────────
export const acknowledge = api<AcknowledgeRequest, AcknowledgeResponse>(
  {
    auth: true,
    expose: true,
    method: "POST",
    path: "/bulletins/:id/acknowledge",
  },
  async (req) => {
    const auth = getAuthData()!;

    const bulletin = await db.queryRow<{
      id: number;
      requires_ack: boolean;
    }>`
      SELECT id, requires_ack FROM bulletins WHERE id = ${req.id}
    `;
    if (!bulletin) {
      throw APIError.notFound("bulletin not found");
    }
    if (!bulletin.requires_ack) {
      throw APIError.failedPrecondition(
        "this bulletin does not require acknowledgement"
      );
    }

    const row = await db.queryRow<{ acknowledged_at: Date }>`
      INSERT INTO bulletin_reads (bulletin_id, user_id, acknowledged_at)
      VALUES (${req.id}, ${auth.userID}, NOW())
      ON CONFLICT (bulletin_id, user_id) DO UPDATE
        SET acknowledged_at = COALESCE(
          bulletin_reads.acknowledged_at,   -- keep the original ack timestamp
          EXCLUDED.acknowledged_at
        )
      RETURNING acknowledged_at
    `;

    // Audit log — useful if a crew member later disputes whether they
    // saw a safety-critical bulletin.
    await logActivity({
      user_id: auth.userID,
      action: "acknowledge_bulletin",
      entity_type: "bulletin",
      entity_id: req.id.toString(),
      details: {},
    });

    return {
      ok: true,
      acknowledged_at: (row?.acknowledged_at ?? new Date()).toISOString(),
    };
  }
);
