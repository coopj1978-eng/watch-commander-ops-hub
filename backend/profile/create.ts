import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import { syncSkillsToDictionary } from "../dictionary/sync_skills";
import type { CreateProfileRequest, FirefighterProfile } from "./types";

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

export const create = api<CreateProfileRequest, FirefighterProfile>(
  { auth: true, expose: true, method: "POST", path: "/profiles" },
  async (req) => {
    const auth = getAuthData()!;
    
    if (req.skills && req.skills.length > 0) {
      await syncSkillsToDictionary(req.skills);
    }
    
    const existingProfile = await db.queryRow<DBProfile>`
      SELECT * FROM firefighter_profiles WHERE user_id = ${req.user_id}
    `;

    if (existingProfile) {
      return transformProfile(existingProfile);
    }

    const dbProfile = await db.queryRow<DBProfile>`
      INSERT INTO firefighter_profiles (
        user_id, service_number, station, shift, rank, hire_date,
        phone, emergency_contact_name, emergency_contact_phone,
        certifications, skills, driver_lgv, driver_erd, prps, ba, notes,
        last_one_to_one_date, next_one_to_one_date
      )
      VALUES (
        ${req.user_id}, ${req.service_number}, ${req.station}, ${req.shift},
        ${req.rank}, ${req.hire_date}, ${req.phone}, ${req.emergency_contact_name},
        ${req.emergency_contact_phone}, ${req.certifications}, ${req.skills},
        ${req.driver?.lgv || false}, ${req.driver?.erd || false}, ${req.prps || false}, ${req.ba || false}, ${req.notes},
        ${req.last_one_to_one_date}, ${req.next_one_to_one_date}
      )
      RETURNING *
    `;

    if (!dbProfile) {
      throw new Error("Failed to create profile");
    }

    const profile = transformProfile(dbProfile);

    await logActivity({
      user_id: auth.userID,
      action: "create_profile",
      entity_type: "profile",
      entity_id: profile.id.toString(),
      details: { user_id: req.user_id },
    });

    return profile;
  }
);
