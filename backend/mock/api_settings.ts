import { api } from "encore.dev/api";

interface AbsenceTriggers {
  id: string;
  sixMonth: {
    episodes: number;
    days: number;
  };
  oneYear: {
    episodes: number;
    days: number;
  };
}

let mockSettings: AbsenceTriggers = {
  id: "absenceTriggers",
  sixMonth: {
    episodes: 3,
    days: 10,
  },
  oneYear: {
    episodes: 5,
    days: 20,
  },
};

export const getAbsenceTriggers = api(
  { expose: true, method: "GET", path: "/api/settings/absence-triggers" },
  async (): Promise<{ data: AbsenceTriggers }> => {
    return { data: mockSettings };
  }
);

interface UpdateAbsenceTriggersRequest {
  sixMonth?: {
    episodes?: number;
    days?: number;
  };
  oneYear?: {
    episodes?: number;
    days?: number;
  };
}

export const updateAbsenceTriggers = api(
  { expose: true, method: "PUT", path: "/api/settings/absence-triggers" },
  async (
    updates: UpdateAbsenceTriggersRequest
  ): Promise<{ data: AbsenceTriggers }> => {
    if (updates.sixMonth) {
      mockSettings.sixMonth = {
        ...mockSettings.sixMonth,
        ...updates.sixMonth,
      };
    }
    if (updates.oneYear) {
      mockSettings.oneYear = {
        ...mockSettings.oneYear,
        ...updates.oneYear,
      };
    }

    return { data: mockSettings };
  }
);
