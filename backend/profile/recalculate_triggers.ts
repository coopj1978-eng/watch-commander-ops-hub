import { api } from "encore.dev/api";
import db from "../db";
import type { TriggerStage } from "./types";
import type { Absence } from "../absence/types";
import type { SystemSettings } from "../settings/types";

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
  { method: "POST", path: "/profile/recalculate-triggers", expose: true },
  async (req) => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const sicknessAbsencesGen = db.query<Absence>`
      SELECT * FROM absences
      WHERE firefighter_id = ${req.user_id}
        AND type = 'sickness'
        AND start_date >= ${sixMonthsAgo}
    `;

    const sicknessAbsences: Absence[] = [];
    for await (const absence of sicknessAbsencesGen) {
      sicknessAbsences.push(absence);
    }

    const rollingSickEpisodes = sicknessAbsences.length;
    let rollingSickDays = 0;

    for (const absence of sicknessAbsences) {
      const startDate = new Date(absence.start_date);
      const endDate = new Date(absence.end_date);
      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      rollingSickDays += days;
    }

    const settings = await db.rawQueryRow<SystemSettings>(
      `SELECT * FROM system_settings ORDER BY id DESC LIMIT 1`
    );

    if (!settings) {
      throw new Error("System settings not found");
    }

    let triggerStage: TriggerStage = "None";

    if (
      rollingSickEpisodes >= settings.trigger_stage3_episodes ||
      rollingSickDays >= settings.trigger_stage3_days
    ) {
      triggerStage = "Stage3";
    } else if (
      rollingSickEpisodes >= settings.trigger_stage2_episodes ||
      rollingSickDays >= settings.trigger_stage2_days
    ) {
      triggerStage = "Stage2";
    } else if (
      rollingSickEpisodes >= settings.trigger_stage1_episodes ||
      rollingSickDays >= settings.trigger_stage1_days
    ) {
      triggerStage = "Stage1";
    }

    interface ProfileTriggerData {
      trigger_stage: TriggerStage;
    }

    const currentProfile = await db.queryRow<ProfileTriggerData>`
      SELECT trigger_stage FROM firefighter_profiles
      WHERE user_id = ${req.user_id}
    `;

    const previousTriggerStage = currentProfile?.trigger_stage || "None";

    await db.exec`
      UPDATE firefighter_profiles
      SET 
        rolling_sick_episodes = ${rollingSickEpisodes},
        rolling_sick_days = ${rollingSickDays},
        trigger_stage = ${triggerStage},
        updated_at = NOW()
      WHERE user_id = ${req.user_id}
    `;

    return {
      rolling_sick_episodes: rollingSickEpisodes,
      rolling_sick_days: rollingSickDays,
      trigger_stage: triggerStage,
      previous_trigger_stage: previousTriggerStage,
      changed: previousTriggerStage !== triggerStage,
    };
  }
);
