import { api } from "encore.dev/api";
import type { Dictionary, CreateDictionaryRequest } from "./types";

export const create = api<CreateDictionaryRequest, Dictionary>(
  { method: "POST", path: "/dictionary", expose: true },
  async (req) => {
    const newItem: Dictionary = {
      id: Math.floor(Math.random() * 10000),
      type: req.type,
      value: req.value,
      active: req.active ?? true,
      created_at: new Date(),
    };

    return newItem;
  }
);
