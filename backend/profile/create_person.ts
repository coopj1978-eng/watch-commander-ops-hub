import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import { syncSkillsToDictionary } from "../dictionary/sync_skills";
import type { FirefighterProfile } from "./types";
import type { User } from "../user/types";

interface CreatePersonRequest {
  name: string;
  email: string;
  service_number?: string;
  rank?: string;
  watch_unit?: string;
  phone?: string;
  address?: string;
}

interface CreatePersonResponse {
  user: User;
  profile: FirefighterProfile;
}

interface DBUser {
  id: string;
  email: string;
  name: string;
  role: string;
  watch_unit?: string;
  rank?: string;
  avatar_url?: string;
  last_login_at?: Date;
  is_active: boolean;
  left_at?: Date;
  created_at: Date;
  updated_at: Date;
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

function transformUser(dbUser: DBUser): User {
  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role as any,
    watch_unit: dbUser.watch_unit,
    rank: dbUser.rank,
    avatar_url: dbUser.avatar_url,
    last_login_at: dbUser.last_login_at,
    is_active: dbUser.is_active,
    left_at: dbUser.left_at,
    created_at: dbUser.created_at,
    updated_at: dbUser.updated_at,
  };
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
        ? driver_pathway_lgv_passed_date.toISOString().split("T")[0]
        : undefined,
    };
  }

  if (last_conversation_date && last_conversation_text) {
    profile.lastConversation = {
      date: last_conversation_date.toISOString().split("T")[0],
      text: last_conversation_text,
    };
  }

  return profile;
}

export const createPerson = api<CreatePersonRequest, CreatePersonResponse>(
  { auth: true, expose: true, method: "POST", path: "/people" },
  async (req) => {
    const auth = getAuthData()!;
    
    if (req.service_number) {
      await syncSkillsToDictionary([]);
    }

    const existingUser = await db.queryRow<DBUser>`
      SELECT * FROM users WHERE email = ${req.email}
    `;

    let user: User;
    let userId: string;

    if (existingUser) {
      const existingProfile = await db.queryRow<DBProfile>`
        SELECT * FROM firefighter_profiles WHERE user_id = ${existingUser.id}
      `;

      if (existingProfile) {
        throw APIError.alreadyExists(
          `A profile already exists for user with email ${req.email}`
        );
      }

      if (!existingUser.is_active) {
        await db.exec`
          UPDATE users SET is_active = true WHERE id = ${existingUser.id}
        `;
        existingUser.is_active = true;
      }

      user = transformUser(existingUser);
      userId = existingUser.id;
    } else {
      userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const newUser = await db.queryRow<DBUser>`
        INSERT INTO users (id, email, name, role, watch_unit, rank, is_active)
        VALUES (
          ${userId},
          ${req.email},
          ${req.name},
          'FF',
          ${req.watch_unit || null},
          ${req.rank || null},
          false
        )
        RETURNING *
      `;

      if (!newUser) {
        throw new Error("Failed to create user");
      }

      user = transformUser(newUser);
    }

    const dbProfile = await db.queryRow<DBProfile>`
      INSERT INTO firefighter_profiles (
        user_id, service_number, rank, phone, watch,
        driver_lgv, driver_erd, prps, ba,
        rolling_sick_episodes, rolling_sick_days, trigger_stage,
        skills, certifications
      )
      VALUES (
        ${userId},
        ${req.service_number || null},
        ${req.rank || null},
        ${req.phone || null},
        ${req.watch_unit || null},
        false,
        false,
        false,
        false,
        0,
        0,
        'None',
        ARRAY[]::text[],
        ARRAY[]::text[]
      )
      RETURNING *
    `;

    if (!dbProfile) {
      throw new Error("Failed to create profile");
    }

    const profile = transformProfile(dbProfile);

    await logActivity({
      user_id: auth.userID,
      action: "create_person",
      entity_type: "profile",
      entity_id: profile.id.toString(),
      details: {
        user_id: userId,
        name: req.name,
        email: req.email,
      },
    });

    return { user, profile };
  }
);
