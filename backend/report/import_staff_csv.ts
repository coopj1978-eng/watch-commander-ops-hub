import { api, APIError } from "encore.dev/api";
import db from "../db";
import { logActivity } from "../logging/logger";

interface ImportStaffCsvRequest {
  csv_data: string;
  user_id: string;
}

interface ImportStaffCsvResponse {
  imported_count: number;
  errors: string[];
}

export const importStaffCsv = api<ImportStaffCsvRequest, ImportStaffCsvResponse>(
  { expose: true, method: "POST", path: "/reports/import-staff" },
  async ({ csv_data, user_id }) => {
    const lines = csv_data.trim().split("\n");
    if (lines.length < 2) {
      throw APIError.invalidArgument("CSV must have at least a header and one data row");
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const requiredHeaders = ["id", "email", "name", "role"];

    for (const required of requiredHeaders) {
      if (!headers.includes(required)) {
        throw APIError.invalidArgument(`missing required header: ${required}`);
      }
    }

    let importedCount = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const row: Record<string, string> = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });

      try {
        const idIndex = headers.indexOf("id");
        const emailIndex = headers.indexOf("email");
        const nameIndex = headers.indexOf("name");
        const roleIndex = headers.indexOf("role");

        const userId = values[idIndex];
        const email = values[emailIndex];
        const name = values[nameIndex];
        const role = values[roleIndex];

        if (!userId || !email || !name || !role) {
          errors.push(`Row ${i + 1}: missing required fields`);
          continue;
        }

        if (!["WC", "CC", "FF", "RO"].includes(role)) {
          errors.push(`Row ${i + 1}: invalid role "${role}"`);
          continue;
        }

        await db.exec`
          INSERT INTO users (id, email, name, role)
          VALUES (${userId}, ${email}, ${name}, ${role})
          ON CONFLICT (id) DO UPDATE
          SET email = EXCLUDED.email, name = EXCLUDED.name, role = EXCLUDED.role, updated_at = NOW()
        `;

        importedCount++;
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : "unknown error"}`);
      }
    }

    await logActivity({
      user_id: user_id,
      action: "import_staff_csv",
      entity_type: "report",
      entity_id: null,
      details: { imported_count: importedCount, error_count: errors.length },
    });

    return {
      imported_count: importedCount,
      errors,
    };
  }
);
