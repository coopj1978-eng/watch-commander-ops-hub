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
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

function calculateSkillStatus(expiryDate?: Date): { status: SkillStatus; days_until_expiry?: number } {
  if (!expiryDate) {
    return { status: "valid" };
  }

  const now = new Date();
  const expiry = new Date(expiryDate);
  const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) {
    return { status: "expired", days_until_expiry: daysUntilExpiry };
  } else if (daysUntilExpiry <= 30) {
    return { status: "warning", days_until_expiry: daysUntilExpiry };
  } else {
    return { status: "valid", days_until_expiry: daysUntilExpiry };
  }
}

function transformSkillRenewal(db: DBSkillRenewal): SkillRenewal {
  const { status, days_until_expiry } = calculateSkillStatus(db.expiry_date);
  
  return {
    ...db,
    status,
    days_until_expiry,
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
