import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { recalcTriggersForUser } from "../lib/sickness";
import { absenceViewer, assertCanViewAbsencesOf } from "../lib/absenceAccess";
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
    getAuthData()!;
    // It returns their sickness totals, so: the person, or a WC/CC on their
    // watch — the same rule as everything else about sickness.
    await assertCanViewAbsencesOf(await absenceViewer(), req.user_id);
    return recalcTriggersForUser(req.user_id);
  }
);
