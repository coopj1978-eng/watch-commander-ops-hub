-- One place for skills (John, Nov 2026). The People list showed each
-- person's old skills list (firefighter_profiles.skills, from when everyone
-- was first loaded) alongside their skill records, but their own page only
-- shows the records. Copy the old list into skill records, with no dates, so
-- dates can be added later; skip any they already have ("Hooklift" is the
-- "Hooklift Operator" skill, and "PRPS" and "PRPS Trained" are the same).
-- The old list is left as it was but no longer shown.
WITH old AS (
  SELECT DISTINCT p.id AS profile_id,
    CASE lower(trim(s)) WHEN 'hooklift' THEN 'Hooklift Operator' ELSE trim(s) END AS skill_name
  FROM firefighter_profiles p, unnest(p.skills) AS s
  WHERE trim(s) <> ''
)
INSERT INTO skill_renewals (profile_id, skill_name)
SELECT o.profile_id, o.skill_name
FROM old o
WHERE NOT EXISTS (
  SELECT 1 FROM skill_renewals r
  WHERE r.profile_id = o.profile_id
    AND regexp_replace(lower(trim(r.skill_name)), '^prps trained$', 'prps')
      = regexp_replace(lower(o.skill_name), '^prps trained$', 'prps')
);
