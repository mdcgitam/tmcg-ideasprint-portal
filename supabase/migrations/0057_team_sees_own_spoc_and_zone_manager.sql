-- 0057_team_sees_own_spoc_and_zone_manager.sql
-- profiles_select has always granted a SPOC visibility into their team
-- members' profiles (0001) and, more recently, mutual SPOC<->Zone Manager
-- visibility (0045/0046) — but never the reverse for a Team Lead/Member:
-- there was no clause letting them read their OWN team's assigned SPOC's
-- profile row, or their zone's Zone Manager's. The Team dashboard's SPOC
-- field (Profile tab) has been reading team.spoc_profile_id correctly and
-- then querying `profiles` for that id's name — RLS silently returned no
-- row, so it always rendered "Not yet assigned" regardless of what the
-- admin actually set. Zone Manager was never queried/shown at all.
--
-- Adds the two missing predicates, same shape as is_zone_manager_of_profile
-- (0036) / is_room_spoc_of_zone_manager (0045) / is_zone_manager_of_spoc
-- (0046) already use for the mirrored relationships.

create or replace function public.is_my_teams_spoc(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.teams t
    where t.id = public.current_team_id() and t.spoc_profile_id = p_profile_id
  );
$$;
revoke all on function public.is_my_teams_spoc(uuid) from public, anon;
grant execute on function public.is_my_teams_spoc(uuid) to authenticated;

create or replace function public.is_my_teams_zone_manager(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.teams t
    join public.rooms r on r.id = t.room_id
    join public.zones z on z.id = r.zone_id
    where t.id = public.current_team_id() and z.zone_manager_profile_id = p_profile_id
  );
$$;
revoke all on function public.is_my_teams_zone_manager(uuid) from public, anon;
grant execute on function public.is_my_teams_zone_manager(uuid) to authenticated;

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
    OR (("current_role"() = 'Campus Admin'::user_role) AND (campus = current_campus()))
  )
  OR public.is_platform_admin()
);
