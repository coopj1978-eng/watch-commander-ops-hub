import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import type { Inspection } from "../inspection/types";
import { mockInspections } from "./data";

interface GetMockInspectionsRequest {
  status?: Query<string>;
  type?: Query<string>;
}

interface GetMockInspectionsResponse {
  inspections: Inspection[];
  total: number;
}

export const getMockInspections = api<GetMockInspectionsRequest, GetMockInspectionsResponse>(
  { expose: true, method: "GET", path: "/api/mock/inspections" },
  async (req) => {
    let inspections = mockInspections;
    
    if (req.status) {
      inspections = inspections.filter(i => i.status === req.status);
    }
    
    if (req.type) {
      inspections = inspections.filter(i => i.type === req.type);
    }

    return {
      inspections,
      total: inspections.length,
    };
  }
);

interface GetMockInspectionRequest {
  id: number;
}

export const getMockInspection = api<GetMockInspectionRequest, Inspection>(
  { expose: true, method: "GET", path: "/api/mock/inspections/:id" },
  async ({ id }) => {
    const inspection = mockInspections.find(i => i.id === id);
    if (!inspection) {
      throw new Error("Inspection not found");
    }
    return inspection;
  }
);
