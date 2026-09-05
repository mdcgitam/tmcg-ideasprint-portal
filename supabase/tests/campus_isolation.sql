-- supabase/tests/campus_isolation.sql — run AFTER 0025 is applied.
-- The SQL Editor bypasses RLS, so true isolation is verified by logging in as
-- each campus Super Admin in the app. This script only sanity-checks the seed
-- data and that the campus columns/counters exist.
-- NOTE: the first participant User ID for a campus is x…1000 UNLESS campus Super
-- Admins were seeded first — each seed_campus_super_admin call consumes one id.

select 'seeded super admins' as check,
       campus, count(*) as n
from public.profiles where role = 'Super Admin' group by campus order by campus;
-- expect: one row each for BLR, HYD, VSP (n = 1)

select 'campus counters' as check, campus_code, next_user_seq
from public.campus_counters order by campus_code;
-- expect: BLR>=1000, HYD>=1000, VSP>=1000

select 'teams without campus' as check, count(*) as n
from public.teams where campus is null;   -- expect 0

select 'profiles without campus' as check, count(*) as n
from public.profiles where campus is null; -- expect 0
