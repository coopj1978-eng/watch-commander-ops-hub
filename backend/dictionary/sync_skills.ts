import db from "../db";

export async function syncSkillsToDictionary(skills: string[]): Promise<void> {
  if (!skills || skills.length === 0) {
    return;
  }

  for (const skill of skills) {
    const trimmedSkill = skill.trim();
    if (!trimmedSkill) continue;

    const existing = await db.queryRow<{ id: number }>`
      SELECT id FROM dictionaries 
      WHERE type = 'skill' AND LOWER(value) = LOWER(${trimmedSkill})
    `;

    if (!existing) {
      await db.exec`
        INSERT INTO dictionaries (type, value, active)
        VALUES ('skill', ${trimmedSkill}, true)
        ON CONFLICT DO NOTHING
      `;
    }
  }
}
