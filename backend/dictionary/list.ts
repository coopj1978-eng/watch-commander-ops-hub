import { api } from "encore.dev/api";
import type { Dictionary, DictionaryType } from "./types";

export interface ListDictionaryRequest {
  type?: DictionaryType;
  active?: boolean;
}

export interface ListDictionaryResponse {
  items: Dictionary[];
}

export const list = api<ListDictionaryRequest, ListDictionaryResponse>(
  { method: "GET", path: "/dictionary", expose: true },
  async (req) => {
    const items: Dictionary[] = [
      {
        id: 1,
        type: "skill",
        value: "First Aid",
        active: true,
        created_at: new Date("2024-01-15"),
      },
      {
        id: 2,
        type: "skill",
        value: "Water Rescue",
        active: true,
        created_at: new Date("2024-01-15"),
      },
      {
        id: 3,
        type: "skill",
        value: "Rope Rescue",
        active: true,
        created_at: new Date("2024-01-15"),
      },
      {
        id: 4,
        type: "cert",
        value: "HAZMAT Level 1",
        active: true,
        created_at: new Date("2024-01-15"),
      },
      {
        id: 5,
        type: "cert",
        value: "HAZMAT Level 2",
        active: true,
        created_at: new Date("2024-01-15"),
      },
      {
        id: 6,
        type: "cert",
        value: "Incident Command",
        active: true,
        created_at: new Date("2024-01-15"),
      },
    ];

    let filtered = items;

    if (req.type) {
      filtered = filtered.filter((item) => item.type === req.type);
    }

    if (req.active !== undefined) {
      filtered = filtered.filter((item) => item.active === req.active);
    }

    return { items: filtered };
  }
);
