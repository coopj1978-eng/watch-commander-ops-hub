import { api } from "encore.dev/api";

interface MockAbsence {
  id: string;
  firefighterId: string;
  type: "sickness" | "AL" | "TOIL" | "parental" | "other";
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string;
  createdByUserId: string;
  createdAt: string;
}

let mockAbsences: MockAbsence[] = [
  {
    id: "absence_1",
    firefighterId: "person_1",
    type: "AL",
    startDate: "2025-02-10",
    endDate: "2025-02-14",
    totalDays: 5,
    reason: "Annual leave",
    createdByUserId: "person_1",
    createdAt: "2025-01-15T10:00:00Z",
  },
  {
    id: "absence_2",
    firefighterId: "person_1",
    type: "sickness",
    startDate: "2024-12-20",
    endDate: "2024-12-22",
    totalDays: 3,
    reason: "Flu",
    createdByUserId: "admin_1",
    createdAt: "2024-12-20T08:00:00Z",
  },
  {
    id: "absence_3",
    firefighterId: "person_2",
    type: "TOIL",
    startDate: "2025-01-20",
    endDate: "2025-01-20",
    totalDays: 1,
    reason: "TOIL from overtime",
    createdByUserId: "person_2",
    createdAt: "2025-01-18T14:00:00Z",
  },
];

export const getMockAbsences = api(
  { expose: true, method: "GET", path: "/api/people/:id/absences" },
  async ({ id }: { id: string }): Promise<{ data: MockAbsence[] }> => {
    const absences = mockAbsences.filter((a) => a.firefighterId === id);
    return { data: absences };
  }
);

export const createMockAbsence = api(
  { expose: true, method: "POST", path: "/api/people/:id/absences" },
  async ({
    id,
    type,
    startDate,
    endDate,
    totalDays,
    reason,
    createdByUserId,
  }: {
    id: string;
    type: "sickness" | "AL" | "TOIL" | "parental" | "other";
    startDate: string;
    endDate: string;
    totalDays: number;
    reason?: string;
    createdByUserId: string;
  }): Promise<{ data: MockAbsence }> => {
    const newAbsence: MockAbsence = {
      id: `absence_${Date.now()}`,
      firefighterId: id,
      type,
      startDate,
      endDate,
      totalDays,
      reason,
      createdByUserId,
      createdAt: new Date().toISOString(),
    };

    mockAbsences.push(newAbsence);
    return { data: newAbsence };
  }
);
