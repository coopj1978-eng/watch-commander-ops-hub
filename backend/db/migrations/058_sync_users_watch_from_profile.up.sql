-- Data repair: historical drift left some users with users.watch_unit = NULL
-- even though their firefighter_profiles.watch was correctly populated.
-- This causes dashboards (getStats, etc.) to show "0 total staff" for those
-- users because the watch lookup for the logged-in user returns NULL.
--
-- Going forward, profile/update.ts already keeps the two columns in sync;
-- this migration repairs the legacy rows. admin accounts (no watch) are left
-- untouched — they're intentionally unassigned.
UPDATE users u
SET watch_unit = fp.watch
FROM firefighter_profiles fp
WHERE fp.user_id = u.id
  AND u.watch_unit IS NULL
  AND fp.watch     IS NOT NULL
  AND u.role IN ('WC', 'CC', 'FF');
