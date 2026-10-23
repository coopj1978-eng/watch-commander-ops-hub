import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { recalcTriggersForUser } from "../lib/sickness";
import type { TriggerStage } from "./types";

interface RecalculateTriggersRequest {
  user_id: string;
}

interface RecalculateTriggersResponse {
  rolling_sick_episodes: number;
  rolling_sick_days: number;
  trigger_stage: TriggerStage;
  previous_trigger_stage: TriggerStage;
  changed: boolean;
}

export const recalculateTriggers = api<RecalculateTriggersRequest, RecalculateTriggersResponse>(
  { auth: true, method: "POST", path: "/profile/recalculate-triggers", expose: true },
  async (req) => {
    const auth = getAuthData()!;
    if (auth.role !== "WC" && auth.role !== "CC" && auth.userID !== req.user_id) {
      throw APIError.permissionDenied("Not allowed to recalculate another person's triggers");
    }
    return recalcTriggersForUser(req.user_id);
  }
);
