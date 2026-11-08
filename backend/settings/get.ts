import { api } from "encore.dev/api";
import db from "../db";
import type { SystemSettings } from "./types";

export const get = api<void, SystemSettings>(
  { auth: true, expose: true, method: "GET", path: "/api/settings" },
  async () => {
    const settings = await db.rawQueryRow<SystemSettings>(
      `SELECT * FROM system_settings ORDER BY id DESC LIMIT 1`
    );

    if (!settings) {
      throw new Error("System settings not found");
    }

    // Saves before 8 Nov 2026 could store the switches as a JSON string.
    if (typeof settings.feature_flags === "string") {
      try { settings.feature_flags = JSON.parse(settings.feature_flags); } catch { /* leave as is */ }
    }

    return settings;
  }
);
