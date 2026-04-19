import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { GetTrainingRequest, TrainingRecord, Attendee } from "./types";

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

interface DBAttendee {
  user_id?: string | null;
  user_name?: string | null;
  external_name?: string | null;
  external_rank?: string | null;
  external_station?: string | null;
  competencies_covered: string[];
  notes?: string;
}

export const get = api<GetTrainingRequest, TrainingRecord>(
  { auth: true, expose: true, method: "GET", path: "/training/:id" },
  async (req) => {
    getAuthData()!;

    const row = await db.rawQueryRow<DBTrainingRecord>(
      `SELECT * FROM training_records WHERE id = $1`,
      req.id
    );

    if (!row) {
      throw APIError.notFound("training record not found");
    }

    const trainingDate =
      typeof row.training_date === "string"
        ? row.training_date.split("T")[0]
        : row.training_date.toISOString().split("T")[0];

    // Fetch attendees — both internal (joined on users) and external (free-text).
    const attendeeRows = await db.rawQueryAll<DBAttendee>(
      `SELECT
         ta.user_id,
         u.name                AS user_name,
         ta.external_name,
         ta.external_rank,
         ta.external_station,
         ta.competencies_covered,
         ta.notes
       FROM training_attendance ta
       LEFT JOIN users u ON u.id = ta.user_id
       WHERE ta.training_id = $1
       ORDER BY
         (ta.user_id IS NULL) ASC,                  -- internal first
         COALESCE(u.name, ta.external_name) ASC`,
      req.id
    );

    const attendees: Attendee[] = attendeeRows.map((a) => ({
      user_id: a.user_id ?? undefined,
      user_name: a.user_name ?? a.external_name ?? "Unknown",
      external_rank: a.external_rank ?? undefined,
      external_station: a.external_station ?? undefined,
      is_external: !a.user_id,
      competencies_covered: a.competencies_covered ?? [],
      notes: a.notes ?? undefined,
    }));

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
      attendees,
    };
  }
);
