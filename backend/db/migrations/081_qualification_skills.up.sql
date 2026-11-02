-- Crewing qualifications and skills in step (John, Nov 2026): each tick on a
-- person's Overview (BA, PRPS, Mass Decon, Hooklift, LGV, OIC) is a skill on
-- their Skills tab (lib/qualifications.ts). Bring them into line now: a tick
-- with no skill gets the skill (no dates), and a skill with no tick gets the
-- tick.
INSERT INTO skill_renewals (profile_id, skill_name)
SELECT p.id, q.skill
FROM firefighter_profiles p
CROSS JOIN (VALUES
  ('ba', 'BA', ARRAY['ba']),
  ('prps', 'PRPS Trained', ARRAY['prps trained', 'prps']),
  ('mass_decon', 'Mass Decon', ARRAY['mass decon']),
  ('hooklift_operator', 'Hooklift Operator', ARRAY['hooklift operator', 'hooklift']),
  ('driver_lgv', 'LGV', ARRAY['lgv']),
  ('oic', 'OIC', ARRAY['oic'])
) AS q(col, skill, names)
WHERE COALESCE(CASE q.col
    WHEN 'ba' THEN p.ba WHEN 'prps' THEN p.prps WHEN 'mass_decon' THEN p.mass_decon
    WHEN 'hooklift_operator' THEN p.hooklift_operator WHEN 'driver_lgv' THEN p.driver_lgv WHEN 'oic' THEN p.oic
  END, false)
  AND NOT EXISTS (SELECT 1 FROM skill_renewals r WHERE r.profile_id = p.id AND lower(trim(r.skill_name)) = ANY(q.names));

UPDATE firefighter_profiles p SET
  ba = EXISTS (SELECT 1 FROM skill_renewals r WHERE r.profile_id = p.id AND lower(trim(r.skill_name)) = ANY(ARRAY['ba'])),
  prps = EXISTS (SELECT 1 FROM skill_renewals r WHERE r.profile_id = p.id AND lower(trim(r.skill_name)) = ANY(ARRAY['prps trained', 'prps'])),
  mass_decon = EXISTS (SELECT 1 FROM skill_renewals r WHERE r.profile_id = p.id AND lower(trim(r.skill_name)) = ANY(ARRAY['mass decon'])),
  hooklift_operator = EXISTS (SELECT 1 FROM skill_renewals r WHERE r.profile_id = p.id AND lower(trim(r.skill_name)) = ANY(ARRAY['hooklift operator', 'hooklift'])),
  driver_lgv = EXISTS (SELECT 1 FROM skill_renewals r WHERE r.profile_id = p.id AND lower(trim(r.skill_name)) = ANY(ARRAY['lgv'])),
  oic = EXISTS (SELECT 1 FROM skill_renewals r WHERE r.profile_id = p.id AND lower(trim(r.skill_name)) = ANY(ARRAY['oic']));

-- OIC is a skill now too, so it can be picked on the Skills tab.
INSERT INTO dictionaries (type, value, active) VALUES ('skill', 'OIC', true) ON CONFLICT DO NOTHING;
