import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import { createNotification } from "../notification/helpers";
import type {
  Bulletin,
  BulletinScope,
  BulletinPriority,
  CreateBulletinRequest,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// POST /bulletins
//
// Post a new bulletin. Permission rules:
//   • WC: can post to their own watch OR station-wide
//   • CC: can post to their own watch only
//   • FF: blocked
//
// On successful create, fires a `bulletin_posted` notification to every
// user in the bulletin's audience (minus the poster). Recipients are
// computed from users.watch_unit and firefighter_profiles.watch using the
// same dual-column trick the rest of the app uses for watch lookups.
// ─────────────────────────────────────────────────────────────────────────────

interface DBBulletin {
  id: number;
  posted_by: string;
  scope: string;
  watch_unit: string | null;
  title: string;
  body: string;
  priority: string;
  requires_ack: boolean;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function toBulletin(row: DBBulletin, postedByName?: string): Bulletin {
  return {
    id: row.id,
    posted_by: row.posted_by,
    posted_by_name: postedByName,
    scope: row.scope as BulletinScope,
    watch_unit: row.watch_unit ?? undefined,
    title: row.title,
    body: row.body,
    priority: row.priority as BulletinPriority,
    requires_ack: row.requires_ack,
    expires_at: row.expires_at ? row.expires_at.toISOString() : undefined,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export const create = api<CreateBulletinRequest, Bulletin>(
  { auth: true, expose: true, method: "POST", path: "/api/bulletins" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.title?.trim()) {
      throw APIError.invalidArgument("title is required");
    }
    if (!req.body?.trim()) {
      throw APIError.invalidArgument("body is required");
    }
    if (req.scope !== "watch" && req.scope !== "station") {
      throw APIError.invalidArgument("scope must be 'watch' or 'station'");
    }

    // Pull the poster's role + watch to validate scope permissions and
    // default watch_unit when not supplied.
    const poster = await db.queryRow<{
      role: string;
      watch_unit: string | null;
      name: string;
    }>`
      SELECT role, watch_unit, name
      FROM users
      WHERE id = ${auth.userID}
    `;

    if (!poster) {
      throw APIError.unauthenticated("user not found");
    }
    if (poster.role !== "WC" && poster.role !== "CC") {
      throw APIError.permissionDenied("only WC or CC can post bulletins");
    }

    // Station-scoped bulletins are WC-only — a CC doesn't get to broadcast
    // across every watch at the station.
    if (req.scope === "station" && poster.role !== "WC") {
      throw APIError.permissionDenied(
        "only a Watch Commander can post station-wide bulletins"
      );
    }

    let resolvedWatch: string | null = null;
    if (req.scope === "watch") {
      resolvedWatch = req.watch_unit?.trim() || poster.watch_unit;
      if (!resolvedWatch) {
        throw APIError.invalidArgument(
          "watch_unit is required for watch-scoped bulletins"
        );
      }
      // A CC can't post to a watch other than their own.
      if (
        poster.role === "CC" &&
        resolvedWatch.toLowerCase() !== (poster.watch_unit ?? "").toLowerCase()
      ) {
        throw APIError.permissionDenied(
          "a Crew Commander can only post to their own watch"
        );
      }
    }

    const priority: BulletinPriority = req.priority ?? "routine";
    const requiresAck = req.requires_ack ?? false;

    const row = await db.queryRow<DBBulletin>`
      INSERT INTO bulletins (
        posted_by, scope, watch_unit, title, body,
        priority, requires_ack, expires_at
      )
      VALUES (
        ${auth.userID},
        ${req.scope},
        ${resolvedWatch},
        ${req.title.trim()},
        ${req.body.trim()},
        ${priority},
        ${requiresAck},
        ${req.expires_at ? new Date(req.expires_at) : null}
      )
      RETURNING *
    `;

    if (!row) {
      throw APIError.internal("failed to create bulletin");
    }

    // ── Audience resolution + notification dispatch ─────────────────────────
    // For a watch-scoped bulletin we notify every active user whose watch
    // (via either users.watch_unit or firefighter_profiles.watch) matches.
    // For station-scoped we notify every active WC/CC/FF — the intended
    // audience is everyone at the station.
    //
    // The poster is always excluded from their own notification.
    try {
      const recipients =
        req.scope === "station"
          ? await db.rawQueryAll<{ id: string }>(
              `SELECT u.id FROM users u
               WHERE u.role IN ('WC', 'CC', 'FF')
                 AND u.left_at IS NULL
                 AND u.id != $1`,
              auth.userID
            )
          : await db.rawQueryAll<{ id: string }>(
              `SELECT DISTINCT u.id FROM users u
               LEFT JOIN firefighter_profiles fp ON fp.user_id = u.id
               WHERE u.role IN ('WC', 'CC', 'FF')
                 AND u.left_at IS NULL
                 AND u.id != $2
                 AND (LOWER(u.watch_unit) = LOWER($1) OR LOWER(fp.watch) = LOWER($1))`,
              resolvedWatch!,
              auth.userID
            );

      const priorityPrefix =
        priority === "urgent"
          ? "🚨 Urgent: "
          : priority === "important"
          ? "⚠️ Important: "
          : "📢 ";
      const ackSuffix = requiresAck ? " (acknowledgement required)" : "";

      for (const recipient of recipients) {
        await createNotification({
          user_id: recipient.id,
          type: "bulletin_posted",
          title: `${priorityPrefix}${row.title}`,
          message: `${poster.name} posted a new ${
            req.scope === "station" ? "station" : resolvedWatch + " Watch"
          } bulletin${ackSuffix}.`,
          entity_type: "bulletin",
          entity_id: row.id.toString(),
          link: "/bulletins",
        });
      }
    } catch (err) {
      // Never block the create on a notification failure.
      console.error("Failed to dispatch bulletin notifications:", err);
    }

    await logActivity({
      user_id: auth.userID,
      action: "create_bulletin",
      entity_type: "bulletin",
      entity_id: row.id.toString(),
      details: {
        scope: req.scope,
        watch_unit: resolvedWatch,
        priority,
        requires_ack: requiresAck,
      },
    });

    return toBulletin(row, poster.name);
  }
);
