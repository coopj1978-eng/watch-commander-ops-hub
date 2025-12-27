import { api, Query } from "encore.dev/api";
import db from "../db";
import type { Dictionary, DictionaryType } from "./types";

export interface ListDictionaryRequest {
  type?: Query<DictionaryType>;
  active?: Query<boolean>;
}

export interface ListDictionaryResponse {
  items: Dictionary[];
}

interface DBDictionary {
  id: number;
  type: string;
  value: string;
  active: boolean;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export const list = api<ListDictionaryRequest, ListDictionaryResponse>(
  { method: "GET", path: "/dictionary", expose: true },
  async (req) => {
    let query = `SELECT * FROM dictionaries WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (req.type) {
      query += ` AND type = $${paramIndex++}`;
      params.push(req.type);
    }

    if (req.active !== undefined) {
      query += ` AND active = $${paramIndex++}`;
      params.push(req.active);
    }

    query += ` ORDER BY type, value`;

    const dbItems = await db.rawQueryAll<DBDictionary>(query, ...params);

    const items: Dictionary[] = dbItems.map(item => ({
      id: item.id,
      type: item.type as DictionaryType,
      value: item.value,
      active: item.active,
      created_at: item.created_at,
    }));

    return { items };
  }
);
