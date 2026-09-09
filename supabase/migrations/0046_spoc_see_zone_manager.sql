-- 0046_spoc_see_zone_manager.sql
-- Mirror of 0045_zone_manager_see_room_spocs.sql: a SPOC saw "Unassigned" for
-- their own room's Zone Manager (Attendance/NOC/PPT/ID Cards/Profile "Zone
-- Manager" column and filter), for the same reason in reverse —
-- profiles_select never granted a SPOC visibility into the Zone Manager's
-- own profile row, only into team participants.
--
-- Fix: add the mirrored predicate ("this profile is the Zone Manager of a
-- zone containing my assigned room") and OR it into profiles_select.

create or replace function public.is_zone_manager_of_spoc(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.rooms r
    join public.zones z on z.id = r.zone_id
    where z.zone_manager_profile_id = p_profile_id
      and r.spoc_profile_id = public.current_profile_id()
  );
$$;
revoke all on function public.is_zone_manager_of_spoc(uuid) from public, anon;
grant execute on function public.is_zone_manager_of_spoc(uuid) to authenticated;

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
    OR (("current_role"() = 'Campus Admin'::user_role) AND (campus = current_campus()))
  )
  OR public.is_platform_admin()
);
