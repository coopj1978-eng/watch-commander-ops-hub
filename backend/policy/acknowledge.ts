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
  version: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /policies/:id/acknowledge
//
// Record that the current user has read and understood this policy at its
// current version. Idempotent — repeated calls for the same (policy, user,
// version) triple keep the original acknowledged_at.
//
// Does NOT require the policy to have requires_ack = true — a crew member
// can pre-emptively acknowledge a reference doc if they want the receipt
// on record. The requires_ack flag just controls whether the prompt is
// surfaced in the UI.
// ─────────────────────────────────────────────────────────────────────────────
export const acknowledge = api<AcknowledgeRequest, AcknowledgeResponse>(
  { auth: true, expose: true, method: "POST", path: "/policies/:id/acknowledge" },
  async (req) => {
    const auth = getAuthData()!;

    const policy = await db.queryRow<{ id: number; version: string | null }>`
      SELECT id, version FROM policy_docs WHERE id = ${req.id}
    `;
    if (!policy) {
      throw APIError.notFound("policy not found");
    }

    const row = await db.queryRow<{ acknowledged_at: Date }>`
      INSERT INTO policy_acknowledgements (policy_id, user_id, version)
      VALUES (${req.id}, ${auth.userID}, ${policy.version})
      ON CONFLICT (policy_id, user_id, version) DO UPDATE
        SET acknowledged_at = policy_acknowledgements.acknowledged_at
      RETURNING acknowledged_at
    `;

    // Audit — matches the bulletin-acknowledge pattern so "did they read
    // the updated SOP" is answerable from the activity log.
    await logActivity({
      user_id: auth.userID,
      action: "acknowledge_policy",
      entity_type: "policy",
      entity_id: req.id.toString(),
      details: { version: policy.version },
    });

    return {
      ok: true,
      acknowledged_at: (row?.acknowledged_at ?? new Date()).toISOString(),
      version: policy.version,
    };
  }
);
