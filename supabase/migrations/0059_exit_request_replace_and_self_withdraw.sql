-- 0059_exit_request_replace_and_self_withdraw.sql
-- Two gaps found while designing the Exit Requests redesign's "while a
-- request is still open" actions:
--
-- 1. request_member_exit (0058) blocked a second submission outright
--    (EXIT_REQUEST_ALREADY_PENDING) while one was already `Requested` —
--    but the requester should be able to "Replace" the file/reason on an
--    still-open request without needing it rejected first. Switched to an
--    upsert targeting the partial unique index (profile_id) WHERE status =
--    'Requested' — replaces that one open row in place; every previously
--    *resolved* row is untouched (it's a different row, not matched by
--    that partial index), so history still accumulates correctly.
-- 2. delete_exit_request ("withdraw") only ever allowed the profile's Team
--    Lead (or Super Admin) — a plain Member couldn't withdraw their own
--    open request without asking their Lead to do it. Widened to
--    is_own_or_led_profile, same self-or-lead shape request_member_exit
--    already uses.

create or replace function public.request_member_exit(p_profile_id uuid, p_file_path text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_team_id uuid;
begin
  if not public.is_own_or_led_profile(p_profile_id) then raise exception 'NOT_ALLOWED'; end if;

  select team_id into v_team_id from public.team_members where profile_id = p_profile_id;
  if v_team_id is null then raise exception 'PARTICIPANT_NOT_FOUND'; end if;

  insert into public.exit_requests (profile_id, team_id, file_path, status, reason, requested_at, requested_by)
  values (p_profile_id, v_team_id, p_file_path, 'Requested', p_reason, now(), public.current_profile_id())
  on conflict (profile_id) where status = 'Requested' do update
    set file_path = excluded.file_path, reason = excluded.reason, requested_at = now(), requested_by = excluded.requested_by;

  insert into public.notifications (recipient_profile_id, type, title, message)
  select id, 'MemberExitRequested', 'Exit request submitted', 'A team member has submitted an exit form.'
  from public.profiles
  where ((role = 'Campus Admin' and campus = (select campus from public.teams where id = v_team_id)) or role = 'Super Admin')
     or id = (select spoc_profile_id from public.teams where id = v_team_id)
     or id = (select z.zone_manager_profile_id
              from public.teams t join public.rooms r on r.id = t.room_id join public.zones z on z.id = r.zone_id
              where t.id = v_team_id);
end;
$$;
revoke all on function public.request_member_exit(uuid, text, text) from public, anon;
grant execute on function public.request_member_exit(uuid, text, text) to authenticated;

create or replace function public.delete_exit_request(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_own_or_led_profile(p_profile_id) or public.current_role() = 'Super Admin') then
    raise exception 'NOT_ALLOWED';
  end if;

  delete from public.exit_requests where profile_id = p_profile_id and status = 'Requested';
end;
$$;
revoke all on function public.delete_exit_request(uuid) from public, anon;
grant execute on function public.delete_exit_request(uuid) to authenticated;

-- Exit Request History's "Reviewed By" column needs to resolve a name for
-- whoever resolved a request — which could be a Campus Admin or Super
-- Admin outside the team's own SPOC/Zone Manager, neither of whom
-- profiles_select otherwise grants a Team Lead/Member visibility into.
create or replace function public.is_my_exit_reviewer(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.exit_requests er
    where er.reviewed_by = p_profile_id
      and (er.profile_id = public.current_profile_id() or public.is_led_profile(er.profile_id))
  );
$$;
revoke all on function public.is_my_exit_reviewer(uuid) from public, anon;
grant execute on function public.is_my_exit_reviewer(uuid) to authenticated;

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
    OR public.is_my_exit_reviewer(profiles.id)
    OR (("current_role"() = 'Campus Admin'::user_role) AND (campus = current_campus()))
  )
  OR public.is_platform_admin()
);
