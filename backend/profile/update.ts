import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import { syncSkillsToDictionary } from "../dictionary/sync_skills";
import type { UpdateProfileRequest, FirefighterProfile } from "./types";

interface UpdateProfileParams {
  id: number;
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

export const update = api(
  { auth: true, expose: true, method: "PATCH", path: "/profiles/:id" },
  async (params: UpdateProfileParams & UpdateProfileRequest): Promise<FirefighterProfile> => {
    const { id, ...updates } = params;
    const auth = getAuthData()!;
    
    if (updates.skills && updates.skills.length > 0) {
      await syncSkillsToDictionary(updates.skills);
    }
    const setClauses: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (updates.service_number !== undefined) {
      setClauses.push(`service_number = $${paramIndex++}`);
      queryParams.push(updates.service_number);
    }
    if (updates.station !== undefined) {
      setClauses.push(`station = $${paramIndex++}`);
      queryParams.push(updates.station);
    }
    if (updates.shift !== undefined) {
      setClauses.push(`shift = $${paramIndex++}`);
      queryParams.push(updates.shift);
    }
    if (updates.rank !== undefined) {
      setClauses.push(`rank = $${paramIndex++}`);
      queryParams.push(updates.rank);
    }
    if (updates.hire_date !== undefined) {
      setClauses.push(`hire_date = $${paramIndex++}`);
      queryParams.push(updates.hire_date);
    }
    if (updates.phone !== undefined) {
      setClauses.push(`phone = $${paramIndex++}`);
      queryParams.push(updates.phone);
    }
    if (updates.emergency_contact_name !== undefined) {
      setClauses.push(`emergency_contact_name = $${paramIndex++}`);
      queryParams.push(updates.emergency_contact_name);
    }
    if (updates.emergency_contact_phone !== undefined) {
      setClauses.push(`emergency_contact_phone = $${paramIndex++}`);
      queryParams.push(updates.emergency_contact_phone);
    }
    if (updates.certifications !== undefined) {
      setClauses.push(`certifications = $${paramIndex++}`);
      queryParams.push(updates.certifications);
    }
    if (updates.skills !== undefined) {
      setClauses.push(`skills = $${paramIndex++}`);
      queryParams.push(updates.skills);
    }
    if (updates.driver !== undefined) {
      setClauses.push(`driver_lgv = $${paramIndex++}`);
      queryParams.push(updates.driver.lgv);
      setClauses.push(`driver_erd = $${paramIndex++}`);
      queryParams.push(updates.driver.erd);
    }
    if (updates.prps !== undefined) {
      setClauses.push(`prps = $${paramIndex++}`);
      queryParams.push(updates.prps);
    }
    if (updates.ba !== undefined) {
      setClauses.push(`ba = $${paramIndex++}`);
      queryParams.push(updates.ba);
    }
    if (updates.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex++}`);
      queryParams.push(updates.notes);
    }
    if (updates.last_one_to_one_date !== undefined) {
      setClauses.push(`last_one_to_one_date = $${paramIndex++}`);
      queryParams.push(updates.last_one_to_one_date);
    }
    if (updates.next_one_to_one_date !== undefined) {
      setClauses.push(`next_one_to_one_date = $${paramIndex++}`);
      queryParams.push(updates.next_one_to_one_date);
    }
    if (updates.driverPathway !== undefined) {
      setClauses.push(`driver_pathway_status = $${paramIndex++}`);
      queryParams.push(updates.driverPathway.status);
      setClauses.push(`driver_pathway_lgv_passed_date = $${paramIndex++}`);
      queryParams.push(updates.driverPathway.lgvPassedDate ? new Date(updates.driverPathway.lgvPassedDate) : null);
    }
    if (updates.lastConversation !== undefined) {
      setClauses.push(`last_conversation_date = $${paramIndex++}`);
      queryParams.push(updates.lastConversation.date ? new Date(updates.lastConversation.date) : null);
      setClauses.push(`last_conversation_text = $${paramIndex++}`);
      queryParams.push(updates.lastConversation.text);
    }
    if (updates.customFields !== undefined) {
      setClauses.push(`custom_fields = $${paramIndex++}`);
      queryParams.push(JSON.stringify(updates.customFields));
    }

    if (setClauses.length === 0) {
      throw APIError.invalidArgument("no updates provided");
    }

    setClauses.push(`updated_at = NOW()`);
    queryParams.push(id);

    const query = `
      UPDATE firefighter_profiles
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const dbProfile = await db.rawQueryRow<DBProfile>(query, ...queryParams);

    if (!dbProfile) {
      throw APIError.notFound("profile not found");
    }

    const profile = transformProfile(dbProfile);

    await logActivity({
      user_id: auth.userID,
      action: "update_profile",
      entity_type: "profile",
      entity_id: profile.id.toString(),
      details: updates,
    });

    return profile;
  }
);
