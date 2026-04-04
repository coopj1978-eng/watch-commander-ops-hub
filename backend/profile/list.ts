import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import db from "../db";
import type { FirefighterProfile } from "./types";

interface ListProfilesRequest {
  station?: Query<string>;
  shift?: Query<string>;
  watch?: Query<string>;
  limit?: Query<number>;
  offset?: Query<number>;
}

interface ListProfilesResponse {
  profiles: FirefighterProfile[];
  total: number;
}

interface DBProfile {
  id: number;
  user_id: string;
  service_number?: string;
  station?: string;
  shift?: string;
  watch?: string;
  rank?: string;
  hire_date?: Date;
  phone?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  skills?: string[];
  certifications?: string[];
  driver_lgv: boolean;
  driver_erd: boolean;
  driver_pathway_status?: string;
  driver_pathway_lgv_passed_date?: Date;
  prps?: boolean;
  ba?: boolean;
  notes?: string;
  last_one_to_one_date?: Date;
  next_one_to_one_date?: Date;
  last_conversation_date?: Date;
  last_conversation_text?: string;
  custom_fields?: Record<string, string | number | boolean | null>;
  rolling_sick_episodes: number;
  rolling_sick_days: number;
  trigger_stage: string;
  created_at: Date;
  updated_at: Date;
}

function transformProfile(dbProfile: DBProfile): FirefighterProfile {
  const {
    driver_lgv,
    driver_erd,
    driver_pathway_status,
    driver_pathway_lgv_passed_date,
    last_conversation_date,
    last_conversation_text,
    ...rest
  } = dbProfile;
  
  const profile: FirefighterProfile = {
    ...rest,
    watch: (rest.watch as any) || undefined,
    driver: {
      lgv: driver_lgv || false,
      erd: driver_erd || false,
    },
    trigger_stage: rest.trigger_stage as any,
  };

  if (driver_pathway_status) {
    profile.driverPathway = {
      status: driver_pathway_status as any,
      lgvPassedDate: driver_pathway_lgv_passed_date
        ? (driver_pathway_lgv_passed_date instanceof Date
            ? driver_pathway_lgv_passed_date.toISOString()
            : String(driver_pathway_lgv_passed_date)
          ).split("T")[0]
        : undefined,
    };
  }

  if (last_conversation_date && last_conversation_text) {
    profile.lastConversation = {
      date: (last_conversation_date instanceof Date
        ? last_conversation_date.toISOString()
        : String(last_conversation_date)
      ).split("T")[0],
      text: last_conversation_text,
    };
  }

  return profile;
}

export const list = api<ListProfilesRequest, ListProfilesResponse>(
  { expose: true, method: "GET", path: "/profiles" },
  async (req) => {
    const limit = req.limit || 50;
    const offset = req.offset || 0;

    // Join users table so we can filter by watch_unit (profiles may not have watch set)
    let query = `
      SELECT fp.*
      FROM firefighter_profiles fp
      JOIN users u ON u.id = fp.user_id
    `;
    let countQuery = `
      SELECT COUNT(*) as count
      FROM firefighter_profiles fp
      JOIN users u ON u.id = fp.user_id
    `;
    const params: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    if (req.station) {
      conditions.push(`fp.station = $${paramIndex++}`);
      params.push(req.station);
    }
    if (req.shift) {
      conditions.push(`fp.shift = $${paramIndex++}`);
      params.push(req.shift);
    }
    if (req.watch) {
      // Filter by users.watch_unit (authoritative) OR fp.watch (legacy)
      conditions.push(`(u.watch_unit = $${paramIndex} OR fp.watch = $${paramIndex})`);
      paramIndex++;
      params.push(req.watch);
    }

    if (conditions.length > 0) {
      const whereClause = ` WHERE ${conditions.join(" AND ")}`;
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const dbProfiles = await db.rawQueryAll<DBProfile>(query, ...params);
    const profiles = dbProfiles.map(transformProfile);
    
    const countResult = await db.rawQueryRow<{ count: number }>(
      countQuery,
      ...(conditions.length > 0 ? params.slice(0, -2) : [])
    );

    return {
      profiles,
      total: Number(countResult?.count) || 0,
    };
  }
);
