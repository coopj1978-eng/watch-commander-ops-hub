import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import type { Target } from "../targets/types";
import { mockTargets } from "./data";

interface GetMockTargetsRequest {
  metric?: Query<string>;
  status?: Query<string>;
}

interface GetMockTargetsResponse {
  targets: Target[];
  total: number;
}

export const getMockTargets = api<GetMockTargetsRequest, GetMockTargetsResponse>(
  { expose: true, method: "GET", path: "/api/mock/targets" },
  async (req) => {
    let targets = mockTargets;
    
    if (req.metric) {
      targets = targets.filter(t => t.metric === req.metric);
    }
    
    if (req.status) {
      targets = targets.filter(t => t.status === req.status);
    }

    return {
      targets,
      total: targets.length,
    };
  }
);

interface GetMockTargetRequest {
  id: number;
}

export const getMockTarget = api<GetMockTargetRequest, Target>(
  { expose: true, method: "GET", path: "/api/mock/targets/:id" },
  async ({ id }) => {
    const target = mockTargets.find(t => t.id === id);
    if (!target) {
      throw new Error("Target not found");
    }
    return target;
  }
);
