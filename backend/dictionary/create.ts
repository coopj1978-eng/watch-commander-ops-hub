import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { requirePermission, Permission } from "../auth/rbac";
import { logActivity } from "../logging/logger";
import type { Dictionary, CreateDictionaryRequest } from "./types";

interface DBDictionary {
  id: number;
  type: string;
  value: string;
  active: boolean;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export const create = api<CreateDictionaryRequest, Dictionary>(
  { auth: true, method: "POST", path: "/dictionary", expose: true },
  async (req) => {
    try {
      const auth = getAuthData()!;
      requirePermission(auth, Permission.EDIT_ALL_PROFILES);

      const existing = await db.queryRow<DBDictionary>`
        SELECT * FROM dictionaries 
        WHERE type = ${req.type} AND LOWER(value) = LOWER(${req.value})
      `;

      if (existing) {
        throw new Error(`${req.type === 'skill' ? 'Skill' : 'Certification'} "${req.value}" already exists`);
      }

      const dbItem = await db.queryRow<DBDictionary>`
        INSERT INTO dictionaries (type, value, active, created_by)
        VALUES (${req.type}, ${req.value}, ${req.active ?? true}, ${auth.userID})
        RETURNING *
      `;

      if (!dbItem) {
        throw new Error("Failed to create dictionary entry");
      }

      await logActivity({
        user_id: auth.userID,
        action: "create_dictionary",
        entity_type: "dictionary",
        entity_id: dbItem.id.toString(),
        details: { type: req.type, value: req.value },
      });

      return {
        id: dbItem.id,
        type: dbItem.type as any,
        value: dbItem.value,
        active: dbItem.active,
        created_at: dbItem.created_at,
      };
    } catch (error) {
      console.error("Error in dictionary.create:", error);
      throw error;
    }
  }
);
