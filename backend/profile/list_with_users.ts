import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import db from "../db";
import type { FirefighterProfile } from "./types";
import type { User } from "../user/types";

interface ListPeopleRequest {
  station?: Query<string>;
  shift?: Query<string>;
  rank?: Query<string>;
  watch_unit?: Query<string>;
  status?: Query<"all" | "active" | "inactive">;
  limit?: Query<number>;
  offset?: Query<number>;
}

interface PersonWithProfile {
  user: User;
  profile: FirefighterProfile | null;
}

interface ListPeopleResponse {
  people: PersonWithProfile[];
  total: number;
}

interface DBUserProfile {
  user_id: string;
  user_email: string;
  user_name: string;
  user_role: string;
  user_watch_unit?: string;
  user_rank?: string;
  user_avatar_url?: string;
  user_last_login_at?: Date;
  user_is_active: boolean;
  user_left_at?: Date;
  user_created_at: Date;
  user_updated_at: Date;
  profile_id?: number;
  profile_service_number?: string;
  profile_station?: string;
  profile_shift?: string;
  profile_rank?: string;
  profile_hire_date?: Date;
  profile_phone?: string;
  profile_emergency_contact_name?: string;
  profile_emergency_contact_phone?: string;
  profile_skills?: string[];
  profile_certifications?: string[];
  profile_driver_lgv?: boolean;
  profile_driver_erd?: boolean;
  profile_watch?: string;
  profile_driver_pathway_status?: string;
  profile_driver_pathway_lgv_passed_date?: Date;
  profile_last_conversation_date?: Date;
  profile_last_conversation_text?: string;
  profile_custom_fields?: Record<string, string | number | boolean | null>;
  profile_prps?: boolean;
  profile_ba?: boolean;
  profile_notes?: string;
  profile_last_one_to_one_date?: Date;
  profile_next_one_to_one_date?: Date;
  profile_rolling_sick_episodes?: number;
  profile_rolling_sick_days?: number;
  profile_trigger_stage?: string;
  profile_created_at?: Date;
  profile_updated_at?: Date;
  skill_renewals?: string[];
}

function transformUserProfile(row: DBUserProfile): PersonWithProfile {
  const user: User = {
    id: row.user_id,
    email: row.user_email,
    name: row.user_name,
    role: row.user_role as any,
    watch_unit: row.user_watch_unit,
    rank: row.user_rank,
    avatar_url: row.user_avatar_url,
    last_login_at: row.user_last_login_at,
    is_active: row.user_is_active,
    left_at: row.user_left_at,
    created_at: row.user_created_at,
    updated_at: row.user_updated_at,
  };

  let profile: FirefighterProfile | null = null;
  if (row.profile_id) {
    profile = {
      id: row.profile_id,
      user_id: row.user_id,
      service_number: row.profile_service_number,
      station: row.profile_station,
      shift: row.profile_shift,
      rank: row.profile_rank,
      hire_date: row.profile_hire_date,
      phone: row.profile_phone,
      emergency_contact_name: row.profile_emergency_contact_name,
      emergency_contact_phone: row.profile_emergency_contact_phone,
      skills: row.skill_renewals || [],
      certifications: row.profile_certifications || [],
      watch: row.profile_watch as any,
      driver: {
        lgv: row.profile_driver_lgv || false,
        erd: row.profile_driver_erd || false,
      },
      driverPathway: row.profile_driver_pathway_status
        ? {
            status: row.profile_driver_pathway_status as any,
            lgvPassedDate: row.profile_driver_pathway_lgv_passed_date && row.profile_driver_pathway_lgv_passed_date instanceof Date
              ? row.profile_driver_pathway_lgv_passed_date.toISOString().split("T")[0]
              : undefined,
          }
        : undefined,
      lastConversation:
        row.profile_last_conversation_date && row.profile_last_conversation_text
          ? {
              date: row.profile_last_conversation_date instanceof Date 
                ? row.profile_last_conversation_date.toISOString().split("T")[0]
                : String(row.profile_last_conversation_date).split("T")[0],
              text: row.profile_last_conversation_text,
            }
          : undefined,
      customFields: row.profile_custom_fields,
      prps: row.profile_prps,
      ba: row.profile_ba,
      notes: row.profile_notes,
      last_one_to_one_date: row.profile_last_one_to_one_date,
      next_one_to_one_date: row.profile_next_one_to_one_date,
      rolling_sick_episodes: row.profile_rolling_sick_episodes || 0,
      rolling_sick_days: row.profile_rolling_sick_days || 0,
      trigger_stage: (row.profile_trigger_stage as any) || "None",
      created_at: row.profile_created_at!,
      updated_at: row.profile_updated_at!,
    };
  }

  return { user, profile };
}

export const listWithUsers = api<ListPeopleRequest, ListPeopleResponse>(
  { expose: true, method: "GET", path: "/people" },
  async (req) => {
    const limit = req.limit || 200;
    const offset = req.offset || 0;
    const status = req.status || "active";

    let query = `
      SELECT 
        u.id as user_id,
        u.email as user_email,
        u.name as user_name,
        u.role as user_role,
        u.watch_unit as user_watch_unit,
        u.rank as user_rank,
        u.avatar_url as user_avatar_url,
        u.last_login_at as user_last_login_at,
        u.is_active as user_is_active,
        u.left_at as user_left_at,
        u.created_at as user_created_at,
        u.updated_at as user_updated_at,
        p.id as profile_id,
        p.service_number as profile_service_number,
        p.station as profile_station,
        p.shift as profile_shift,
        p.rank as profile_rank,
        p.hire_date as profile_hire_date,
        p.phone as profile_phone,
        p.emergency_contact_name as profile_emergency_contact_name,
        p.emergency_contact_phone as profile_emergency_contact_phone,
        p.skills as profile_skills,
        p.certifications as profile_certifications,
        p.driver_lgv as profile_driver_lgv,
        p.driver_erd as profile_driver_erd,
        p.watch as profile_watch,
        p.driver_pathway_status as profile_driver_pathway_status,
        p.driver_pathway_lgv_passed_date as profile_driver_pathway_lgv_passed_date,
        p.last_conversation_date as profile_last_conversation_date,
        p.last_conversation_text as profile_last_conversation_text,
        p.custom_fields as profile_custom_fields,
        p.prps as profile_prps,
        p.ba as profile_ba,
        p.notes as profile_notes,
        p.last_one_to_one_date as profile_last_one_to_one_date,
        p.next_one_to_one_date as profile_next_one_to_one_date,
        p.rolling_sick_episodes as profile_rolling_sick_episodes,
        p.rolling_sick_days as profile_rolling_sick_days,
        p.trigger_stage as profile_trigger_stage,
        p.created_at as profile_created_at,
        p.updated_at as profile_updated_at,
        COALESCE(
          (SELECT array_agg(DISTINCT skill_name) 
           FROM skill_renewals sr 
           WHERE sr.profile_id = p.id), 
          ARRAY[]::text[]
        ) as skill_renewals
      FROM users u
      LEFT JOIN firefighter_profiles p ON u.id = p.user_id
    `;

    let countQuery = `SELECT COUNT(*) as count FROM users u LEFT JOIN firefighter_profiles p ON u.id = p.user_id`;
    const params: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    if (status === "active") {
      conditions.push(`u.is_active = true`);
    } else if (status === "inactive") {
      conditions.push(`u.is_active = false`);
    }

    if (req.station) {
      conditions.push(`p.station = $${paramIndex++}`);
      params.push(req.station);
    }
    if (req.shift) {
      conditions.push(`p.shift = $${paramIndex++}`);
      params.push(req.shift);
    }
    if (req.rank) {
      conditions.push(`p.rank = $${paramIndex++}`);
      params.push(req.rank);
    }
    if (req.watch_unit) {
      conditions.push(`u.watch_unit = $${paramIndex++}`);
      params.push(req.watch_unit);
    }

    if (conditions.length > 0) {
      const whereClause = ` WHERE ${conditions.join(" AND ")}`;
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const rows = await db.rawQueryAll<DBUserProfile>(query, ...params);
    const people = rows.map(transformUserProfile);

    const countResult = await db.rawQueryRow<{ count: number }>(
      countQuery,
      ...params.slice(0, -2)
    );

    return {
      people,
      total: countResult?.count || 0,
    };
  }
);
