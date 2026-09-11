-- 0061_exit_history_reviewer_visibility.sql
-- Exit Requests History shows "Unknown" for Reviewed By whenever the
-- reviewer is a Super Admin (or, generally, any staff member outside the
-- viewer's own campus) — two separate causes:
--
-- 1. fetchAdminDashboardData's staffAccounts is scoped to the viewer's own
--    campus (inCampus()), but a Super Admin's profile has campus = null,
--    so they're never in that list for a Campus Admin/SPOC/Zone Manager
--    viewer — same root cause as 0057's Team-dashboard SPOC/Zone Manager
--    gap, this time on the admin side. Fixed in the app layer with a
--    dedicated, unscoped reviewer-name lookup in ExitSubmissionsRoute.
-- 2. That dedicated lookup still needs RLS to actually permit reading the
--    reviewer's row — profiles_select's 0059 predicate (is_my_exit_reviewer)
--    only covered the requester's own team (self/Team Lead), not an
--    admin looking at a request they can already see via
--    exit_requests_select (their own team as SPOC, their zone as Zone
--    Manager, their campus as Campus Admin). Replaced with a broader
--    predicate covering both cases in one place.

create or replace function public.can_see_exit_reviewer(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.exit_requests er
    join public.teams t on t.id = er.team_id
    where er.reviewed_by = p_profile_id
      and (
        er.profile_id = public.current_profile_id()
        or public.is_led_profile(er.profile_id)
        or t.spoc_profile_id = public.current_profile_id()
        or public.is_zone_manager_of_team(t.id)
        or (public.current_role() = 'Campus Admin' and t.campus = public.current_campus())
      )
  );
$$;
revoke all on function public.can_see_exit_reviewer(uuid) from public, anon;
grant execute on function public.can_see_exit_reviewer(uuid) to authenticated;

drop function if exists public.is_my_exit_reviewer(uuid);

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles as permissive for SELECT to authenticated
using (
  (
    (auth_user_id = auth.uid())
    OR (id IN (SELECT team_members.profile_id FROM team_members WHERE team_members.team_id = current_team_id()))
    OR (id IN (SELECT tm.profile_id FROM (team_members tm JOIN teams t ON t.id = tm.team_id) WHERE t.spoc_profile_id = current_profile_id()))
    OR public.is_zone_manager_of_profile(profiles.id)
    OR public.is_room_spoc_of_zone_manager(profiles.id)
    OR public.is_zone_manager_of_spoc(profiles.id)
    OR public.is_my_teams_spoc(profiles.id)
    OR public.is_my_teams_zone_manager(profiles.id)
    OR public.can_see_exit_reviewer(profiles.id)
    OR (("current_role"() = 'Campus Admin'::user_role) AND (campus = current_campus()))
  )
  OR public.is_platform_admin()
);
