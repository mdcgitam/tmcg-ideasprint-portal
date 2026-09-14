-- 0075_drop_request_submission_notifications.sql
-- Staff no longer get a notification when a team submits a profile edit
-- request or a member submits an exit form — Profile Requests and Exit
-- Submissions are the module to check for open requests, and the
-- notification volume added noise without adding anything actionable (no
-- deep link, just "go check the module" either way). Resolution
-- notifications back to the requester (approved/rejected) are unchanged —
-- only the incoming "someone submitted" pings to staff are dropped.
--
-- Bodies are otherwise identical to 0074's — only the trailing
-- `insert into public.notifications (...)` block is removed from each.

create or replace function public.submit_team_edit_request(p_team_id uuid, p_current_snapshot jsonb, p_requested_changes jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_request_id uuid;
begin
  if not public.is_led_team(p_team_id) then raise exception 'NOT_TEAM_LEAD'; end if;
  if not (select is_active from public.teams where id = p_team_id) then raise exception 'TEAM_NOT_ACTIVE'; end if;
  if exists (select 1 from public.approval_requests where team_id = p_team_id and status = 'Pending') then
    raise exception 'REQUEST_ALREADY_PENDING';
  end if;

  insert into public.approval_requests (team_id, current_snapshot, requested_changes, requested_by, status)
  values (p_team_id, p_current_snapshot, p_requested_changes, public.current_profile_id(), 'Pending')
  returning id into v_request_id;

  update public.teams set status = 'Pending Approval', updated_at = now() where id = p_team_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, previous_value, new_value)
  values (public.current_profile_id(), 'Team Edit Requested', 'team', p_team_id, p_current_snapshot, p_requested_changes);

  return v_request_id;
exception
  when unique_violation then raise exception 'REQUEST_ALREADY_PENDING';
end;
$$;
revoke all on function public.submit_team_edit_request(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.submit_team_edit_request(uuid, jsonb, jsonb) to authenticated;

create or replace function public.request_member_exit(p_profile_id uuid, p_file_path text)
returns void language plpgsql security definer set search_path = public as $$
declare v_team_id uuid;
begin
  if not public.is_own_or_led_profile(p_profile_id) then raise exception 'NOT_ALLOWED'; end if;

  select team_id into v_team_id from public.team_members where profile_id = p_profile_id;
  if v_team_id is null then raise exception 'PARTICIPANT_NOT_FOUND'; end if;
  if not (select is_active from public.teams where id = v_team_id) then raise exception 'TEAM_NOT_ACTIVE'; end if;

  insert into public.exit_requests (profile_id, team_id, file_path, status, requested_at, requested_by)
  values (p_profile_id, v_team_id, p_file_path, 'Requested', now(), public.current_profile_id())
  on conflict (profile_id) where status = 'Requested' do update
    set file_path = excluded.file_path, requested_at = now(), requested_by = excluded.requested_by;
end;
$$;
revoke all on function public.request_member_exit(uuid, text) from public, anon;
grant execute on function public.request_member_exit(uuid, text) to authenticated;
