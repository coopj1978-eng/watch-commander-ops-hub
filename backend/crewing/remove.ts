import { api } from "encore.dev/api";
import db from "../db";

// DELETE /crewing/:id — remove a crew member from a shift
export const remove = api<{ id: number }, { ok: boolean }>(
  { auth: true, expose: true, method: "DELETE", path: "/crewing/:id" },
  async (req) => {
    await db.exec`DELETE FROM shift_crewing WHERE id = ${req.id}`;
    return { ok: true };
  }
);
