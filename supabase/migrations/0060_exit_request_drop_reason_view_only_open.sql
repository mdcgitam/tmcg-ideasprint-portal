-- 0060_exit_request_drop_reason_view_only_open.sql
-- Two cleanups from the Exit Requests redesign walkthrough:
--
-- 1. exit_requests.reason was collected in the upload form but never
--    actually used anywhere in the new Teams/Participants/History UI —
--    dropping the parameter from request_member_exit so nothing writes it
--    going forward. The column itself is left in place (nullable, so this
--    is non-destructive) in case any already-submitted rows have a value
--    worth keeping; it just stops being populated.
-- 2. "View [file]" was showing for a request regardless of status, which
--    read as if a Rejected/Approved submission was still an open, live
--    thing to review. No RPC change needed here — purely the file-view
--    condition in each UI tightened to req.status = 'Requested' (open)
--    only; a resolved request's file is viewable from the History tab
--    instead (History already had no view action, now does).

drop function if exists public.request_member_exit(uuid, text, text);

create or replace function public.request_member_exit(p_profile_id uuid, p_file_path text)
returns void language plpgsql security definer set search_path = public as $$
declare v_team_id uuid;
begin
  if not public.is_own_or_led_profile(p_profile_id) then raise exception 'NOT_ALLOWED'; end if;

  select team_id into v_team_id from public.team_members where profile_id = p_profile_id;
  if v_team_id is null then raise exception 'PARTICIPANT_NOT_FOUND'; end if;

  insert into public.exit_requests (profile_id, team_id, file_path, status, requested_at, requested_by)
  values (p_profile_id, v_team_id, p_file_path, 'Requested', now(), public.current_profile_id())
  on conflict (profile_id) where status = 'Requested' do update
    set file_path = excluded.file_path, requested_at = now(), requested_by = excluded.requested_by;

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
revoke all on function public.request_member_exit(uuid, text) from public, anon;
grant execute on function public.request_member_exit(uuid, text) to authenticated;
