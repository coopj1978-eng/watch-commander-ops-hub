import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import { createNotification } from "../notification/helpers";

interface SetRequiresAckRequest {
  id: number;
  requires_ack: boolean;
}

interface SetRequiresAckResponse {
  ok: true;
  requires_ack: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /policies/:id/require-ack
//
// Toggles the requires_ack flag on a policy. Gated to WC + admin — a CC can
// upload policies but not decide "everyone must ack this." When flipped
// from false → true, every active WC/CC/FF gets a `bulletin_posted`-type
// notification (reusing the type rather than adding a new one) so the
// requirement is impossible to miss.
//
// Flipping true → false doesn't notify or wipe existing acks — they stay
// as history.
// ─────────────────────────────────────────────────────────────────────────────
export const setRequiresAck = api<SetRequiresAckRequest, SetRequiresAckResponse>(
  {
    auth: true,
    expose: true,
    method: "PATCH",
    path: "/policies/:id/require-ack",
  },
  async (req) => {
    const auth = getAuthData()!;

    const caller = await db.queryRow<{ role: string; is_admin: boolean | null }>`
      SELECT role, is_admin FROM users WHERE id = ${auth.userID}
    `;
    if (!caller || (caller.role !== "WC" && !caller.is_admin)) {
      throw APIError.permissionDenied(
        "only a Watch Commander or admin can change this flag"
      );
    }

    const existing = await db.queryRow<{
      id: number;
      title: string;
      version: string | null;
      requires_ack: boolean;
    }>`
      SELECT id, title, version, requires_ack
      FROM policy_docs
      WHERE id = ${req.id}
    `;
    if (!existing) {
      throw APIError.notFound("policy not found");
    }

    // No-op if unchanged — saves a round-trip of notifications.
    if (existing.requires_ack === req.requires_ack) {
      return { ok: true, requires_ack: existing.requires_ack };
    }

    await db.exec`
      UPDATE policy_docs
      SET requires_ack = ${req.requires_ack},
          updated_at = NOW()
      WHERE id = ${req.id}
    `;

    await logActivity({
      user_id: auth.userID,
      action: "set_policy_requires_ack",
      entity_type: "policy",
      entity_id: req.id.toString(),
      details: { requires_ack: req.requires_ack },
    });

    // Dispatch a notification on the false → true transition so no one
    // can claim they missed a newly-required SOP.
    if (req.requires_ack) {
      try {
        const poster = await db.queryRow<{ name: string }>`
          SELECT name FROM users WHERE id = ${auth.userID}
        `;
        const recipients = await db.rawQueryAll<{ id: string }>(
          `SELECT id FROM users
           WHERE role IN ('WC', 'CC', 'FF')
             AND left_at IS NULL
             AND id != $1`,
          auth.userID
        );
        for (const r of recipients) {
          await createNotification({
            user_id: r.id,
            type: "bulletin_posted",
            title: `📋 Acknowledgement required: ${existing.title}`,
            message: `${poster?.name ?? "A Watch Commander"} has flagged this policy for acknowledgement. Please read and confirm.`,
            entity_type: "policy",
            entity_id: existing.id.toString(),
            link: "/policies",
          });
        }
      } catch (err) {
        console.error(
          "Failed to dispatch require-ack notifications:",
          err
        );
      }
    }

    return { ok: true, requires_ack: req.requires_ack };
  }
);
