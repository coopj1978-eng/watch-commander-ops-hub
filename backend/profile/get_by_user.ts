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
  rank?: string;
  hire_date?: Date;
  phone?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  skills?: string[];
  certifications?: string[];
  driver_lgv: boolean;
  driver_erd: boolean;
  prps?: boolean;
  ba?: boolean;
  notes?: string;
  last_one_to_one_date?: Date;
  next_one_to_one_date?: Date;
  rolling_sick_episodes: number;
  rolling_sick_days: number;
  trigger_stage: string;
  created_at: Date;
  updated_at: Date;
}

function transformProfile(dbProfile: DBProfile): FirefighterProfile {
  const { driver_lgv, driver_erd, ...rest } = dbProfile;
  return {
    ...rest,
    driver: {
      lgv: driver_lgv || false,
      erd: driver_erd || false,
    },
    trigger_stage: rest.trigger_stage as any,
  };
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
