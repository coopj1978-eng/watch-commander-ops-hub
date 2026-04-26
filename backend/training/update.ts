import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db, { type SQLPrimitive } from "../db";
import type { UpdateTrainingRequest, TrainingRecord } from "./types";

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

export const update = api<UpdateTrainingRequest, TrainingRecord>(
  { auth: true, expose: true, method: "PUT", path: "/api/training/:id" },
  async (req) => {
    const auth = getAuthData()!;

    const existing = await db.rawQueryRow<{ id: number; created_by: string }>(
      `SELECT id, created_by FROM training_records WHERE id = $1`,
      req.id
    );

    if (!existing) {
      throw APIError.notFound("training record not found");
    }

    // Build dynamic SET clause - only update provided fields
    const setClauses: string[] = [];
    const params: SQLPrimitive[] = [];
    let paramIdx = 1;

    if (req.topic !== undefined) {
      setClauses.push(`topic = $${paramIdx}`);
      params.push(req.topic);
      paramIdx++;
    }

    if (req.training_type !== undefined) {
      setClauses.push(`training_type = $${paramIdx}`);
      params.push(req.training_type);
      paramIdx++;
    }

    if (req.training_date !== undefined) {
      setClauses.push(`training_date = $${paramIdx}::date`);
      params.push(req.training_date);
      paramIdx++;
    }

    if (req.shift_type !== undefined) {
      setClauses.push(`shift_type = $${paramIdx}`);
      params.push(req.shift_type);
      paramIdx++;
    }

    if (req.duration_hours !== undefined) {
      setClauses.push(`duration_hours = $${paramIdx}`);
      params.push(req.duration_hours);
      paramIdx++;
    }

    if (req.notes !== undefined) {
      setClauses.push(`notes = $${paramIdx}`);
      params.push(req.notes);
      paramIdx++;
    }

    if (req.status !== undefined) {
      setClauses.push(`status = $${paramIdx}`);
      params.push(req.status);
      paramIdx++;

      // When status changes to "completed", set completed_at
      if (req.status === "completed") {
        setClauses.push(`completed_at = NOW()`);
      }
    }

    // Always update updated_at
    setClauses.push(`updated_at = NOW()`);

    if (setClauses.length === 1) {
      // Only updated_at, nothing meaningful to update - just return existing
      const row = await db.rawQueryRow<DBTrainingRecord>(
        `SELECT * FROM training_records WHERE id = $1`,
        req.id
      );
      if (!row) throw APIError.internal("failed to fetch training record");
      return transformRecord(row);
    }

    const query = `
      UPDATE training_records
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIdx}
      RETURNING *
    `;
    params.push(req.id);

    const row = await db.rawQueryRow<DBTrainingRecord>(query, ...params);

    if (!row) {
      throw APIError.internal("failed to update training record");
    }

    return transformRecord(row);
  }
);
