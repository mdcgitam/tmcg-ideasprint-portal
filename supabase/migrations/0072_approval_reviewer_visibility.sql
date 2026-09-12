-- 0072_approval_reviewer_visibility.sql
-- Same bug as 0061 (Exit Requests' "Reviewed By: Unknown"), now showing up
-- in Profile Requests: a Super Admin reviewer has no campus, so they're
-- never in a Campus Admin/SPOC/Zone Manager viewer's campus-scoped
-- staffAccounts list, and even with a dedicated unscoped name lookup, RLS
-- doesn't yet grant those roles visibility into a reviewer's profile
-- outside their own team/zone/campus for approval_requests specifically —
-- only the exit_requests case (0061) was covered.

create or replace function public.can_see_approval_reviewer(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.approval_requests ar
    join public.teams t on t.id = ar.team_id
    where ar.reviewed_by = p_profile_id
      and (
        ar.team_id = public.current_team_id()
        or t.spoc_profile_id = public.current_profile_id()
        or public.is_zone_manager_of_team(t.id)
        or (public.current_role() = 'Campus Admin' and t.campus = public.current_campus())
      )
  );
$$;
revoke all on function public.can_see_approval_reviewer(uuid) from public, anon;
grant execute on function public.can_see_approval_reviewer(uuid) to authenticated;

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
    OR public.can_see_approval_reviewer(profiles.id)
    OR (("current_role"() = 'Campus Admin'::user_role) AND (campus = current_campus()))
  )
  OR public.is_platform_admin()
);
