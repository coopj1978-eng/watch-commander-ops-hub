import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";

interface DeleteBulletinRequest {
  id: number;
}

interface DeleteBulletinResponse {
  ok: true;
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /bulletins/:id
//
// Permissions:
//   • The posting user can always delete their own bulletin.
//   • A WC can delete any bulletin (so an oncoming WC can cull stale
//     items from the previous shift).
//
// bulletin_reads rows cascade-delete via the FK so there's no cleanup
// to do here beyond the DELETE.
// ─────────────────────────────────────────────────────────────────────────────
export const deleteBulletin = api<DeleteBulletinRequest, DeleteBulletinResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/bulletins/:id" },
  async (req) => {
    const auth = getAuthData()!;

    const caller = await db.queryRow<{ role: string }>`
      SELECT role FROM users WHERE id = ${auth.userID}
    `;
    if (!caller) {
      throw APIError.unauthenticated("user not found");
    }

    const bulletin = await db.queryRow<{ posted_by: string }>`
      SELECT posted_by FROM bulletins WHERE id = ${req.id}
    `;
    if (!bulletin) {
      throw APIError.notFound("bulletin not found");
    }

    const isAuthor = bulletin.posted_by === auth.userID;
    const isWC = caller.role === "WC";

    if (!isAuthor && !isWC) {
      throw APIError.permissionDenied(
        "only the author or a Watch Commander can delete this bulletin"
      );
    }

    await db.exec`DELETE FROM bulletins WHERE id = ${req.id}`;

    await logActivity({
      user_id: auth.userID,
      action: "delete_bulletin",
      entity_type: "bulletin",
      entity_id: req.id.toString(),
      details: {},
    });

    return { ok: true };
  }
);
