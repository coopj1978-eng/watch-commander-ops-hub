import { api } from "encore.dev/api";

export interface DeleteDictionaryParams {
  id: number;
}

export interface DeleteDictionaryResponse {
  success: boolean;
}

export const deleteDictionary = api<DeleteDictionaryParams, DeleteDictionaryResponse>(
  { method: "DELETE", path: "/dictionary/:id", expose: true },
  async (req) => {
    return { success: true };
  }
);
