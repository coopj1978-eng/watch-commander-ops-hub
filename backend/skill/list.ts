import { api, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { ListSkillRenewalsResponse, SkillRenewal, SkillStatus } from "./types";

interface ListSkillRenewalsRequest {
  profile_id: Query<number>;
}

interface DBSkillRenewal {
  id: number;
  profile_id: number;
  skill_name: string;
  acquired_date?: Date;
  renewal_date?: Date;
  expiry_date?: Date;
  reminder_date?: Date;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

function calculateSkillStatus(expiryDate?: Date, reminderDate?: Date): { status: SkillStatus; days_until_expiry?: number; days_until_reminder?: number } {
  const now = new Date();
  const result: { status: SkillStatus; days_until_expiry?: number; days_until_reminder?: number } = { status: "valid" };

  if (expiryDate) {
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    result.days_until_expiry = daysUntilExpiry;

    if (daysUntilExpiry < 0) {
      result.status = "expired";
    } else if (daysUntilExpiry <= 30) {
      result.status = "warning";
    }
  }

  if (reminderDate) {
    const reminder = new Date(reminderDate);
    const daysUntilReminder = Math.ceil((reminder.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    result.days_until_reminder = daysUntilReminder;
    
    if (daysUntilReminder <= 0 && result.status === "valid") {
      result.status = "warning";
    }
  }

  return result;
}

function transformSkillRenewal(db: DBSkillRenewal): SkillRenewal {
  const { status, days_until_expiry, days_until_reminder } = calculateSkillStatus(db.expiry_date, db.reminder_date);
  
  return {
    ...db,
    status,
    days_until_expiry,
    days_until_reminder,
  };
}

export const list = api<ListSkillRenewalsRequest, ListSkillRenewalsResponse>(
  { auth: true, expose: true, method: "GET", path: "/skills/renewals" },
  async ({ profile_id }) => {
    const auth = getAuthData()!;

    const dbSkills = await db.queryAll<DBSkillRenewal>`
      SELECT * FROM skill_renewals 
      WHERE profile_id = ${profile_id}
      ORDER BY expiry_date ASC NULLS LAST, skill_name ASC
    `;

    const skills = dbSkills.map(transformSkillRenewal);

    return { skills };
  }
);
