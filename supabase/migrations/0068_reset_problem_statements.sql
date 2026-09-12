-- 0068_reset_problem_statements.sql
-- Clean slate for the new per-campus problem statement scheme (0067). The
-- old flat 1..50 catalog (plus stray manual test rows like "PS-001",
-- "ps-1") predates campus-tagging entirely, sorted wrong once campus-aware
-- code was introduced, and a handful of teams had already selected from it
-- during setup/testing. Confirmed with the user this is still pre-launch
-- data — safe to clear so everyone starts fresh under the new V/H/B codes
-- once the Super Admin sets each campus's count and clicks Go Live again.

update public.teams set current_problem_statement_id = null where current_problem_statement_id is not null;
delete from public.problem_statement_selections;
delete from public.problem_statements;
delete from public.configuration where key in ('problem_statement.live_at', 'problem_statement.max_number');
