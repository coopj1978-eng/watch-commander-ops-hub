import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import db from "../db";
import type { FirefighterProfile } from "./types";

interface ListProfilesRequest {
  station?: Query<string>;
  shift?: Query<string>;
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
  return {
    ...rest,
    watch: rest.watch as any,
    driver: {
      lgv: driver_lgv || false,
      erd: driver_erd || false,
    },
    driverPathway: driver_pathway_status
      ? {
          status: driver_pathway_status as any,
          lgvPassedDate: driver_pathway_lgv_passed_date
            ? driver_pathway_lgv_passed_date.toISOString().split("T")[0]
            : undefined,
        }
      : undefined,
    lastConversation:
      last_conversation_date && last_conversation_text
        ? {
            date: last_conversation_date.toISOString().split("T")[0],
            text: last_conversation_text,
          }
        : undefined,
    trigger_stage: rest.trigger_stage as any,
  };
}

export const list = api<ListProfilesRequest, ListProfilesResponse>(
  { expose: true, method: "GET", path: "/profiles" },
  async (req) => {
    const limit = req.limit || 50;
    const offset = req.offset || 0;

    let query = `SELECT * FROM firefighter_profiles`;
    let countQuery = `SELECT COUNT(*) as count FROM firefighter_profiles`;
    const params: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    if (req.station) {
      conditions.push(`station = $${paramIndex++}`);
      params.push(req.station);
    }
    if (req.shift) {
      conditions.push(`shift = $${paramIndex++}`);
      params.push(req.shift);
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
      ...(req.station || req.shift ? params.slice(0, -2) : [])
    );

    return {
      profiles,
      total: countResult?.count || 0,
    };
  }
);
