import { api } from "encore.dev/api";
import db from "../db";
import type { SystemSettings } from "./types";

export const get = api<void, SystemSettings>(
  { auth: true, expose: true, method: "GET", path: "/settings" },
  async () => {
    const settings = await db.rawQueryRow<SystemSettings>(
      `SELECT * FROM system_settings ORDER BY id DESC LIMIT 1`
    );

    if (!settings) {
      throw new Error("System settings not found");
    }

    return settings;
  }
);
