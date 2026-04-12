import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";

/**
 * One-time import endpoint for Notion Personnel data.
 * Only WC role can call this. Creates users + firefighter_profiles
 * with full data: skills, driver pathway, competent status, etc.
 */

interface NotionPerson {
  name: string;
  email?: string;
  phone?: string;
  staff_number?: string;
  rank?: string; // "Fire Fighter", "Crew Commander", "Watch Commander", "FF in Progress"
  watch?: string; // "Amber", "White", "Red", "Blue", "Green"
  skills?: string[]; // ["Banks Person", "LGV", "Mass Decon", ...]
  drivers_pathway?: string[]; // ["LGV Passed", "Blue Lights Completed", ...]
  competent?: string; // "Yes" or "No"
}

interface ImportRequest {
  personnel: NotionPerson[];
  dry_run?: boolean; // If true, just validate without inserting
  station?: string; // Default station for all imports
}

interface ImportResult {
  total: number;
  created: number;
  skipped: number;
  errors: string[];
  details: { name: string; status: string; user_id?: string }[];
}

// Map Notion rank → system role
const RANK_TO_ROLE: Record<string, string> = {
  "Watch Commander": "WC",
  "Crew Commander": "CC",
  "Leading Firefighter": "FF",
  "Fire Fighter": "FF",
  "Firefighter": "FF",
  "FF in Progress": "FF",
};

// Map Notion rank → system rank name
const RANK_NORMALIZE: Record<string, string> = {
  "Watch Commander": "Watch Commander",
  "Crew Commander": "Crew Commander",
  "Leading Firefighter": "Leading Firefighter",
  "Fire Fighter": "Firefighter",
  "Firefighter": "Firefighter",
  "FF in Progress": "Firefighter",
};

// Map Notion driver pathway → system driver_pathway_status
function mapDriverPathway(notionPathway: string[]): { status: string; lgv: boolean; erd: boolean } {
  // Take the most advanced stage
  const result = { status: "", lgv: false, erd: false };

  for (const stage of notionPathway) {
    switch (stage) {
      case "Driver":
        result.lgv = true;
        result.erd = true;
        result.status = "passed";
        break;
      case "Blue Lights Completed":
        result.erd = true;
        result.lgv = true;
        result.status = "passed";
        break;
      case "Blue lights booked":
        result.lgv = true;
        result.status = "awaiting_ERD";
        break;
      case "Completed 200 miles":
        result.lgv = true;
        result.status = "awaiting_ERD";
        break;
      case "LGV Passed":
        result.lgv = true;
        if (!result.erd) result.status = "passed_LGV";
        break;
      case "LGV Booked":
        if (!result.lgv) result.status = "awaiting_course";
        break;
      case "Theory Passed":
        if (!result.lgv) result.status = "awaiting_course";
        break;
      case "Theory Booked":
      case "Theory Training":
        if (!result.lgv) result.status = "awaiting_theory";
        break;
      case "Provisional sent":
        if (!result.lgv) result.status = "application_sent";
        break;
      case "Med Completed":
        if (!result.lgv) result.status = "application_sent";
        break;
      case "Medical Arranged":
      case "Medical Requested":
        if (!result.lgv && !result.status) result.status = "medical_due";
        break;
      case "None":
        // No driver pathway
        break;
    }
  }

  return result;
}

// Check if skills list contains LGV (already a driver)
function hasLGVSkill(skills: string[]): boolean {
  return skills.some(s => s === "LGV");
}

// Check if skills contain PRPS-related
function hasPRPS(skills: string[]): boolean {
  return skills.some(s => s === "PRPS Trained" || s === "PPRPS Instructor");
}

export const importNotionPersonnel = api<ImportRequest, ImportResult>(
  { auth: true, expose: true, method: "POST", path: "/import/notion-personnel" },
  async (req) => {
    const auth = getAuthData()!;

    // Only WC can import
    if (auth.role !== "WC") {
      throw APIError.permissionDenied("Only Watch Commanders can import personnel");
    }

    const result: ImportResult = {
      total: req.personnel.length,
      created: 0,
      skipped: 0,
      errors: [],
      details: [],
    };

    for (const person of req.personnel) {
      try {
        // Clean the name — strip rank prefix if present
        let cleanName = person.name.trim();
        // Remove "CC ", "FF ", "WC " prefix if the name starts with it
        cleanName = cleanName.replace(/^(CC|FF|WC|LFF)\s+/, "");

        // Generate email if missing
        const email = person.email?.trim() ||
          `${cleanName.toLowerCase().replace(/\s+/g, ".")}@firescotland.gov.uk`;

        // Check if user already exists
        const existing = await db.queryRow<{ id: string; email: string }>`
          SELECT id, email FROM users WHERE email = ${email}
        `;

        if (existing) {
          // Check if profile exists
          const existingProfile = await db.queryRow<{ id: number }>`
            SELECT id FROM firefighter_profiles WHERE user_id = ${existing.id}
          `;

          if (existingProfile) {
            result.skipped++;
            result.details.push({ name: cleanName, status: "skipped — already exists", user_id: existing.id });
            continue;
          }
        }

        if (req.dry_run) {
          result.created++;
          result.details.push({ name: cleanName, status: "would create (dry run)" });
          continue;
        }

        // Determine role and rank
        const notionRank = person.rank || "Firefighter";
        const role = RANK_TO_ROLE[notionRank] || "FF";
        const systemRank = RANK_NORMALIZE[notionRank] || "Firefighter";

        // Create user
        let userId: string;
        if (existing) {
          userId = existing.id;
          // Update the existing user with role/rank/watch if needed
          await db.exec`
            UPDATE users SET
              role = ${role},
              rank = ${systemRank},
              watch_unit = ${person.watch || null},
              is_active = true,
              updated_at = NOW()
            WHERE id = ${userId}
          `;
        } else {
          userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          await db.exec`
            INSERT INTO users (id, email, name, role, watch_unit, rank, is_active)
            VALUES (
              ${userId},
              ${email},
              ${cleanName},
              ${role},
              ${person.watch || null},
              ${systemRank},
              true
            )
          `;
        }

        // Process skills
        const skills = person.skills || [];

        // Process driver pathway
        const driverInfo = person.drivers_pathway?.length
          ? mapDriverPathway(person.drivers_pathway)
          : { status: "", lgv: false, erd: false };

        // If they have LGV in skills, they're already a qualified driver
        if (hasLGVSkill(skills)) {
          driverInfo.lgv = true;
          if (!driverInfo.status || driverInfo.status === "medical_due" || driverInfo.status === "application_sent") {
            driverInfo.status = "passed_LGV";
          }
        }

        // Check PRPS
        const prps = hasPRPS(skills);

        // Create profile
        await db.exec`
          INSERT INTO firefighter_profiles (
            user_id, service_number, rank, phone, watch, station,
            driver_lgv, driver_erd,
            driver_pathway_status,
            prps, ba,
            skills, certifications,
            rolling_sick_episodes, rolling_sick_days, trigger_stage,
            notes
          )
          VALUES (
            ${userId},
            ${person.staff_number || null},
            ${systemRank},
            ${person.phone || null},
            ${person.watch || null},
            ${req.station || "Pollok"},
            ${driverInfo.lgv},
            ${driverInfo.erd},
            ${driverInfo.status || null},
            ${prps},
            true,
            ${skills},
            ARRAY[]::text[],
            0,
            0,
            'None',
            ${person.competent === "No" ? "Not yet competent — in development" : null}
          )
        `;

        result.created++;
        result.details.push({ name: cleanName, status: "created", user_id: userId });

        await logActivity({
          user_id: auth.userID,
          action: "import_person",
          entity_type: "profile",
          entity_id: userId,
          details: { name: cleanName, source: "notion" },
        });

      } catch (err: any) {
        result.errors.push(`${person.name}: ${err.message}`);
        result.details.push({ name: person.name, status: `error: ${err.message}` });
      }
    }

    return result;
  }
);
