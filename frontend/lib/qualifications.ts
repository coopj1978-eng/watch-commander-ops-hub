// The crewing qualifications on a profile and the skill each one is — the
// same list as the server's lib/qualifications.ts, which keeps the ticks and
// the skills in step (Nov 2026). `names` are the skill names that count.

export type QualificationKey = "oic" | "ba" | "prps" | "mass_decon" | "hooklift_operator" | "driver_lgv";

export const QUALIFICATIONS: { key: QualificationKey; short: string; label: string; names: string[] }[] = [
  { key: "oic", short: "OIC", label: "Officer in charge", names: ["oic"] },
  { key: "ba", short: "BA", label: "Breathing apparatus", names: ["ba"] },
  { key: "driver_lgv", short: "LGV", label: "LGV driver", names: ["lgv"] },
  { key: "prps", short: "PRPS", label: "Respiratory protection", names: ["prps trained", "prps"] },
  { key: "mass_decon", short: "Decon", label: "Mass decontamination", names: ["mass decon"] },
  { key: "hooklift_operator", short: "Hooklift", label: "Hooklift operator", names: ["hooklift operator", "hooklift"] },
];

/** Whether a skill record is one of the crewing qualifications. */
export function qualificationForSkill(skillName: string): QualificationKey | null {
  const n = skillName.trim().toLowerCase();
  return QUALIFICATIONS.find((q) => q.names.includes(n))?.key ?? null;
}
