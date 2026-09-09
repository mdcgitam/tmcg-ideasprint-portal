-- 0045_zone_manager_see_room_spocs.sql
-- Bug: a Zone Manager sees "Unassigned" for a room/team's SPOC everywhere
-- (Problem Statements, Attendance, NOC, ...) even when a SPOC is correctly
-- assigned. Root cause: profiles_select (0036_zone_manager_access.sql) never
-- grants a Zone Manager visibility into a SPOC's own profile row — only into
-- profiles of participants (team_members) on teams in their zone, which a
-- SPOC's profile never is. staffAccounts (src/lib/dashboard/admin-data.ts)
-- comes back RLS-truncated before the "Unassigned" fallback in *Name()
-- helpers ever runs.
--
-- Fix: add a predicate for "this profile is the SPOC of a room in a zone I
-- manage" and OR it into profiles_select, same shape as the existing
-- is_zone_manager_of_profile clause it sits beside.

create or replace function public.is_room_spoc_of_zone_manager(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.rooms r
    join public.zones z on z.id = r.zone_id
    where r.spoc_profile_id = p_profile_id
      and z.zone_manager_profile_id = public.current_profile_id()
  );
$$;
revoke all on function public.is_room_spoc_of_zone_manager(uuid) from public, anon;
grant execute on function public.is_room_spoc_of_zone_manager(uuid) to authenticated;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles as permissive for SELECT to authenticated
using (
  (
    (auth_user_id = auth.uid())
    OR (id IN (SELECT team_members.profile_id FROM team_members WHERE team_members.team_id = current_team_id()))
    OR (id IN (SELECT tm.profile_id FROM (team_members tm JOIN teams t ON t.id = tm.team_id) WHERE t.spoc_profile_id = current_profile_id()))
    OR public.is_zone_manager_of_profile(profiles.id)
    OR public.is_room_spoc_of_zone_manager(profiles.id)
    OR (("current_role"() = 'Campus Admin'::user_role) AND (campus = current_campus()))
  )
  OR public.is_platform_admin()
);
