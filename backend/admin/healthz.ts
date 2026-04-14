import { api, APIError } from "encore.dev/api";
import db from "../db";

// Public uptime check. UptimeRobot (or any external monitor) hits this every
// few minutes — a 200 means the backend is reachable and the database is
// responding to queries. A 503 means the DB is unreachable, which is
// effectively a full outage since almost every endpoint depends on it.
//
// Deliberately *not* authenticated — monitors can't present credentials.
// Deliberately *only* a DB ping — we don't want a flaky third party
// (Sentry, Clerk, etc.) causing false-positive outage alerts.

interface HealthResponse {
  ok: boolean;
  db: "ok";
  time: string;
}

export const healthz = api<void, HealthResponse>(
  { expose: true, method: "GET", path: "/healthz" },
  async () => {
    try {
      await db.queryRow`SELECT 1 AS ok`;
    } catch (err) {
      throw APIError.unavailable("database unreachable");
    }

    return {
      ok: true,
      db: "ok",
      time: new Date().toISOString(),
    };
  },
);
