import { api } from "encore.dev/api";

interface DictionarySkill {
  id: string;
  type: "skill";
  value: string;
  active: boolean;
  createdAt: string;
}

let mockSkills: DictionarySkill[] = [
  {
    id: "skill_1",
    type: "skill",
    value: "BA",
    active: true,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "skill_2",
    type: "skill",
    value: "RTC",
    active: true,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "skill_3",
    type: "skill",
    value: "Water Rescue",
    active: true,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "skill_4",
    type: "skill",
    value: "Hazmat",
    active: true,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "skill_5",
    type: "skill",
    value: "Technical Rescue",
    active: true,
    createdAt: "2024-01-01T00:00:00Z",
  },
];

export const getSkills = api(
  { expose: true, method: "GET", path: "/api/dictionaries/skills" },
  async (): Promise<{ data: DictionarySkill[] }> => {
    return { data: mockSkills };
  }
);

export const createSkill = api(
  { expose: true, method: "POST", path: "/api/dictionaries/skills" },
  async ({
    value,
    active = true,
  }: {
    value: string;
    active?: boolean;
  }): Promise<{ data: DictionarySkill }> => {
    const existing = mockSkills.find(
      (s) => s.value.toLowerCase() === value.toLowerCase()
    );

    if (existing) {
      return { data: existing };
    }

    const newSkill: DictionarySkill = {
      id: `skill_${Date.now()}`,
      type: "skill",
      value,
      active,
      createdAt: new Date().toISOString(),
    };

    mockSkills.push(newSkill);
    return { data: newSkill };
  }
);
