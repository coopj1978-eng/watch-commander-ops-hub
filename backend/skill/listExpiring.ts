import { api } from "encore.dev/api";
import db from "../db";
import type { ExpiringSkillEntry, ListExpiringSkillsResponse } from "./types";

interface DBExpiringSkill {
  id: number;
  profile_id: number;
  skill_name: string;
  expiry_date?: Date;
  reminder_date?: Date;
  user_id: string;
  user_name: string;
}

function calcStatus(
  expiryDate?: Date,
  reminderDate?: Date,
): { status: "expired" | "warning" | "valid"; days_until_expiry?: number } {
  const now = new Date();

  if (expiryDate) {
    const daysUntilExpiry = Math.ceil(
      (new Date(expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysUntilExpiry < 0) return { status: "expired", days_until_expiry: daysUntilExpiry };
    if (daysUntilExpiry <= 30) return { status: "warning", days_until_expiry: daysUntilExpiry };
  }

  if (reminderDate) {
    const daysUntilReminder = Math.ceil(
      (new Date(reminderDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysUntilReminder <= 0) return { status: "warning" };
  }

  return { status: "valid" };
}

export const listExpiring = api<{}, ListExpiringSkillsResponse>(
  { auth: true, expose: true, method: "GET", path: "/skills/renewals/expiring" },
  async () => {
    const rows = await db.queryAll<DBExpiringSkill>`
      SELECT
        sr.id,
        sr.profile_id,
        sr.skill_name,
        sr.expiry_date,
        sr.reminder_date,
        fp.user_id,
        u.name AS user_name
      FROM skill_renewals sr
      JOIN firefighter_profiles fp ON sr.profile_id = fp.id
      JOIN users u ON fp.user_id = u.id
      WHERE u.left_at IS NULL
        AND (
          (sr.expiry_date IS NOT NULL AND sr.expiry_date <= CURRENT_DATE + INTERVAL '30 days')
          OR
          (
            sr.reminder_date IS NOT NULL
            AND sr.reminder_date <= CURRENT_DATE
            AND (sr.expiry_date IS NULL OR sr.expiry_date > CURRENT_DATE)
          )
        )
      ORDER BY sr.expiry_date ASC NULLS LAST, u.name ASC
      LIMIT 100
    `;

    const skills: ExpiringSkillEntry[] = [];

    for (const row of rows) {
      const { status, days_until_expiry } = calcStatus(row.expiry_date, row.reminder_date);
      if (status === "expired" || status === "warning") {
        skills.push({
          id: row.id,
          profile_id: row.profile_id,
          user_id: row.user_id,
          user_name: row.user_name,
          skill_name: row.skill_name,
          expiry_date: row.expiry_date,
          status,
          days_until_expiry,
        });
      }
    }

    return {
      skills,
      expired_count: skills.filter((s) => s.status === "expired").length,
      warning_count: skills.filter((s) => s.status === "warning").length,
    };
  },
);
