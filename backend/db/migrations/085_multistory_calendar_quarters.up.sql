-- Multi-storey inspections: the station's programme for 2026 (John, 7 Nov 2026).
-- Its quarters are calendar quarters (Q1 = Jan-Mar), not financial ones, and
-- inspection_assignments.year is now the calendar year.
--
--           White  Red  Amber  Blue  Green
--   Q1 Jan    A     B     C     D     E
--   Q2 Apr    B     C     D     E     A
--   Q3 Jul    C     D     E     A     B
--   Q4 Oct    D     E     A     B     C
--
-- Buildings are named by id only: the repo is public, so addresses stay in the database.

UPDATE multistory_inspections SET q1_watch = 'White', q2_watch = 'Green', q3_watch = 'Blue',  q4_watch = 'Amber', updated_at = now() WHERE id IN (2, 3, 4, 5, 6, 7);      -- group A
UPDATE multistory_inspections SET q1_watch = 'Red',   q2_watch = 'White', q3_watch = 'Green', q4_watch = 'Blue',  updated_at = now() WHERE id IN (8, 9, 10, 11, 12, 13);   -- group B
UPDATE multistory_inspections SET q1_watch = 'Amber', q2_watch = 'Red',   q3_watch = 'White', q4_watch = 'Green', updated_at = now() WHERE id IN (14, 15, 16, 17);         -- group C
UPDATE multistory_inspections SET q1_watch = 'Blue',  q2_watch = 'Amber', q3_watch = 'Red',   q4_watch = 'White', updated_at = now() WHERE id IN (18, 19, 20, 21, 22, 23); -- group D
UPDATE multistory_inspections SET q1_watch = 'Green', q2_watch = 'Blue',  q3_watch = 'Amber', q4_watch = 'Red',   updated_at = now() WHERE id IN (24, 25, 26, 28);         -- group E

-- Clear 2026's old rows that aren't on the programme. Only untouched ones go: anything
-- ticked or with a note stays. (White's six ticks from April are group B in Q2, so they stand.)
DELETE FROM inspection_assignments a
 WHERE a.plan_type = 'multistory'
   AND a.year = 2026
   AND a.status = 'pending'
   AND a.notes IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM multistory_inspections p
      WHERE p.id = a.plan_id
        AND a.watch = CASE a.quarter WHEN 1 THEN p.q1_watch WHEN 2 THEN p.q2_watch WHEN 3 THEN p.q3_watch WHEN 4 THEN p.q4_watch END
   );

-- Then make 2026's rows from the programme.
INSERT INTO inspection_assignments (plan_type, plan_id, label, watch, year, quarter)
SELECT 'multistory', p.id, p.address, q.watch, 2026, q.quarter
  FROM multistory_inspections p
 CROSS JOIN LATERAL (VALUES (1, p.q1_watch), (2, p.q2_watch), (3, p.q3_watch), (4, p.q4_watch)) AS q(quarter, watch)
 WHERE q.watch IS NOT NULL
ON CONFLICT (plan_type, plan_id, watch, year, COALESCE(quarter, 0)) DO NOTHING;
