import { api, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db, { type SQLPrimitive } from "../db";
import type { ListTrainingResponse, TrainingRecord } from "./types";

interface DBTrainingRecord {
  id: number;
  watch: string;
  training_date: Date | string;
  shift_type?: string;
  training_type: string;
  topic: string;
  duration_hours?: number;
  notes?: string;
  status: string;
  created_by: string;
  completed_at?: Date | string;
  created_at: Date;
  updated_at: Date;
  total: number;
}

interface ListRequest {
  watch?: Query<string>;
  status?: Query<string>;
  start_date?: Query<string>;
  end_date?: Query<string>;
  limit?: Query<number>;
  offset?: Query<number>;
}

function transformRecord(row: DBTrainingRecord): TrainingRecord {
  const trainingDate =
    typeof row.training_date === "string"
      ? row.training_date.split("T")[0]
      : row.training_date.toISOString().split("T")[0];

  return {
    id: row.id,
    watch: row.watch,
    training_date: trainingDate,
    shift_type: row.shift_type ?? undefined,
    training_type: row.training_type,
    topic: row.topic,
    duration_hours: row.duration_hours ? Number(row.duration_hours) : undefined,
    notes: row.notes ?? undefined,
    status: row.status,
    created_by: row.created_by,
    completed_at: row.completed_at
      ? row.completed_at instanceof Date
        ? row.completed_at.toISOString()
        : String(row.completed_at)
      : undefined,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

export const list = api<ListRequest, ListTrainingResponse>(
  { auth: true, expose: true, method: "GET", path: "/api/training" },
  async (req) => {
    getAuthData()!;

    const limit = req.limit ?? 20;
    const offset = req.offset ?? 0;

    const conditions: string[] = [];
    const params: SQLPrimitive[] = [];
    let paramIdx = 1;

    if (req.watch) {
      conditions.push(`LOWER(t.watch) = LOWER($${paramIdx})`);
      params.push(req.watch);
      paramIdx++;
    }

    if (req.status) {
      conditions.push(`t.status = $${paramIdx}`);
      params.push(req.status);
      paramIdx++;
    }

    if (req.start_date) {
      conditions.push(`t.training_date >= $${paramIdx}::date`);
      params.push(req.start_date);
      paramIdx++;
    }

    if (req.end_date) {
      conditions.push(`t.training_date <= $${paramIdx}::date`);
      params.push(req.end_date);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT t.*, COUNT(*) OVER() AS total
      FROM training_records t
      ${whereClause}
      ORDER BY t.training_date DESC, t.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;

    params.push(limit, offset);

    const rows = await db.rawQueryAll<DBTrainingRecord>(query, ...params);

    const total = rows.length > 0 ? Number(rows[0].total) : 0;

    return {
      records: rows.map(transformRecord),
      total,
    };
  }
);
