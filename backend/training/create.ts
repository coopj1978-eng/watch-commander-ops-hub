import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { CreateTrainingRequest, TrainingRecord } from "./types";

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

export const create = api<CreateTrainingRequest, TrainingRecord>(
  { auth: true, expose: true, method: "POST", path: "/training" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.watch) {
      throw APIError.invalidArgument("watch is required");
    }
    if (!req.training_date) {
      throw APIError.invalidArgument("training_date is required");
    }
    if (!req.training_type) {
      throw APIError.invalidArgument("training_type is required");
    }
    if (!req.topic) {
      throw APIError.invalidArgument("topic is required");
    }

    const row = await db.rawQueryRow<DBTrainingRecord>(
      `INSERT INTO training_records (
        watch, training_date, shift_type, training_type, topic, created_by
      )
      VALUES ($1, $2::date, $3, $4, $5, $6)
      RETURNING *`,
      req.watch,
      req.training_date,
      req.shift_type ?? null,
      req.training_type,
      req.topic,
      auth.userID
    );

    if (!row) {
      throw APIError.internal("failed to create training record");
    }

    return transformRecord(row);
  }
);
