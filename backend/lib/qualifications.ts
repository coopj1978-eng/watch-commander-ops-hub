import db from "../db";

/**
 * The crewing qualifications on a profile (the ticks on a person's Overview)
 * and the skill each one is (John, Nov 2026). They're kept in step: ticking
 * one adds the skill to the person's Skills tab and unticking removes it;
 * adding, renaming or removing the skill ticks or unticks it. `names` are the
 * skill names that count, in lower case.
 */
export const QUALIFICATION_SKILLS = [
  { col: "ba", skill: "BA", names: ["ba"] },
  { col: "prps", skill: "PRPS Trained", names: ["prps trained", "prps"] },
  { col: "mass_decon", skill: "Mass Decon", names: ["mass decon"] },
  { col: "hooklift_operator", skill: "Hooklift Operator", names: ["hooklift operator", "hooklift"] },
  { col: "driver_lgv", skill: "LGV", names: ["lgv"] },
  { col: "oic", skill: "OIC", names: ["oic"] },
] as const;

export type QualificationColumn = (typeof QUALIFICATION_SKILLS)[number]["col"];

/** A qualification was ticked or unticked: add or remove its skill. */
export async function syncSkillsFromQualifications(
  profileId: number,
  ticks: Partial<Record<QualificationColumn, boolean | undefined>>,
): Promise<void> {
  for (const q of QUALIFICATION_SKILLS) {
    const on = ticks[q.col];
    if (on === undefined) continue;
    if (on) {
      await db.rawExec(
        `INSERT INTO skill_renewals (profile_id, skill_name)
         SELECT $1, $2
         WHERE NOT EXISTS (SELECT 1 FROM skill_renewals WHERE profile_id = $1 AND lower(trim(skill_name)) = ANY($3::text[]))`,
        profileId, q.skill, [...q.names]
      );
    } else {
      await db.rawExec(
        `DELETE FROM skill_renewals WHERE profile_id = $1 AND lower(trim(skill_name)) = ANY($2::text[])`,
        profileId, [...q.names]
      );
    }
  }
}

/** A skill was added, renamed or removed: tick or untick the qualifications to match. */
export async function syncQualificationsFromSkills(profileId: number): Promise<void> {
  const sets = QUALIFICATION_SKILLS.map(
    (q, i) => `${q.col} = EXISTS (SELECT 1 FROM skill_renewals r WHERE r.profile_id = p.id AND lower(trim(r.skill_name)) = ANY($${i + 2}::text[]))`
  );
  await db.rawExec(
    `UPDATE firefighter_profiles p SET ${sets.join(", ")} WHERE p.id = $1`,
    profileId, ...QUALIFICATION_SKILLS.map((q) => [...q.names])
  );
}
