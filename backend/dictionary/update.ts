import { api } from "encore.dev/api";
import type { Dictionary, UpdateDictionaryRequest } from "./types";

export interface UpdateDictionaryParams {
  id: number;
}

export const update = api<UpdateDictionaryParams & UpdateDictionaryRequest, Dictionary>(
  { method: "PUT", path: "/dictionary/:id", expose: true },
  async (req) => {
    return {
      id: req.id,
      type: "skill",
      value: req.value ?? "Updated Item",
      active: req.active ?? true,
      created_at: new Date("2024-01-15"),
    };
  }
);
