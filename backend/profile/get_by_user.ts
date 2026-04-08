import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { FirefighterProfile } from "./types";
import { canViewProfile } from "../auth/rbac";

interface GetProfileByUserRequest {
  user_id: string;
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
            ? driver_pathway_lgv_passed_date.toISOString().split("T")[0]
            : String(driver_pathway_lgv_passed_date).split("T")[0])
        : undefined,
    };
  }

  if (last_conversation_date && last_conversation_text) {
    profile.lastConversation = {
      date: last_conversation_date instanceof Date
        ? last_conversation_date.toISOString().split("T")[0]
        : String(last_conversation_date).split("T")[0],
      text: last_conversation_text,
    };
  }

  return profile;
}

export const getByUser = api<GetProfileByUserRequest, FirefighterProfile>(
  { auth: true, expose: true, method: "GET", path: "/profiles/user/:user_id" },
  async ({ user_id }) => {
    const auth = getAuthData()!;

    if (!canViewProfile(auth, user_id)) {
      throw APIError.permissionDenied("Cannot view this profile");
    }

    const dbProfile = await db.queryRow<DBProfile>`
      SELECT * FROM firefighter_profiles WHERE user_id = ${user_id}
    `;

    if (!dbProfile) {
      throw APIError.notFound("profile not found");
    }

    return transformProfile(dbProfile);
  }
);
