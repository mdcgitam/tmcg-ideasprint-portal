-- 0031_platform_admin.sql - wire up the global 'Super Admin' role added in 0030.
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where auth_user_id = auth.uid() and role = 'Super Admin');
$$;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

alter table public.profiles alter column campus drop not null;

-- admin_set_problem_statement
CREATE OR REPLACE FUNCTION public.admin_set_problem_statement(p_team_id uuid, p_ps_number text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ps_id uuid;
  v_ps_title text;
  v_is_initial boolean;
begin
  if not (public.is_assigned_spoc_of_team(p_team_id) or public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.is_platform_admin() and ((select campus from public.teams where id = p_team_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  select id, title into v_ps_id, v_ps_title from public.problem_statements where number = p_ps_number and status = 'Released';
  if v_ps_id is null then
    raise exception 'INVALID_PS_NUMBER';
  end if;

  v_is_initial := not exists (select 1 from public.problem_statement_selections where team_id = p_team_id);

  insert into public.problem_statement_selections (team_id, problem_statement_id, selected_by, is_initial)
  values (p_team_id, v_ps_id, public.current_profile_id(), v_is_initial);

  update public.teams set current_problem_statement_id = v_ps_id, updated_at = now() where id = p_team_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Problem Statement Set By Admin', 'team', p_team_id, jsonb_build_object('ps_number', p_ps_number));

  insert into public.notifications (recipient_profile_id, type, title, message)
  select team_lead_profile_id, 'ProblemStatementChanged', 'Problem statement updated',
         'Your team''s problem statement was updated by an admin/SPOC.'
  from public.teams where id = p_team_id;

  return jsonb_build_object('id', v_ps_id, 'number', p_ps_number, 'title', v_ps_title);
end;
$function$;
revoke all on function public.admin_set_problem_statement(uuid, text) from public, anon;
grant execute on function public.admin_set_problem_statement(uuid, text) to authenticated;

-- assign_room_to_zone
CREATE OR REPLACE FUNCTION public.assign_room_to_zone(p_room_id uuid, p_zone_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then raise exception 'NOT_ALLOWED'; end if;
  if p_zone_id is not null and (select campus from public.rooms where id = p_room_id) is distinct from (select campus from public.zones where id = p_zone_id) then raise exception 'CROSS_CAMPUS'; end if;
  update public.rooms set zone_id = p_zone_id, updated_at = now() where id = p_room_id;
end;
$function$;
revoke all on function public.assign_room_to_zone(uuid, uuid) from public, anon;
grant execute on function public.assign_room_to_zone(uuid, uuid) to authenticated;

-- assign_spoc
CREATE OR REPLACE FUNCTION public.assign_spoc(p_team_id uuid, p_spoc_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_spoc_profile_id is not null
     and (select campus from public.profiles where id = p_spoc_profile_id)
         is distinct from (select campus from public.teams where id = p_team_id)
  then
    raise exception 'CROSS_CAMPUS';
  end if;
  if p_spoc_profile_id is not null and not exists (select 1 from public.profiles where id = p_spoc_profile_id and role = 'SPOC') then
    raise exception 'NOT_A_SPOC';
  end if;

  update public.teams set spoc_profile_id = p_spoc_profile_id, updated_at = now() where id = p_team_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'SPOC Assignment Changed', 'team', p_team_id, jsonb_build_object('spoc_profile_id', p_spoc_profile_id));
end;
$function$;
revoke all on function public.assign_spoc(uuid, uuid) from public, anon;
grant execute on function public.assign_spoc(uuid, uuid) to authenticated;

-- assign_spoc_to_room
CREATE OR REPLACE FUNCTION public.assign_spoc_to_room(p_room_id uuid, p_spoc_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then raise exception 'NOT_ALLOWED'; end if;
  if p_spoc_profile_id is not null and (select campus from public.profiles where id = p_spoc_profile_id) is distinct from (select campus from public.rooms where id = p_room_id) then raise exception 'CROSS_CAMPUS'; end if;
  if p_spoc_profile_id is not null and not exists (select 1 from public.profiles where id = p_spoc_profile_id and role = 'SPOC') then
    raise exception 'NOT_A_SPOC';
  end if;

  update public.rooms set spoc_profile_id = p_spoc_profile_id, updated_at = now() where id = p_room_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Room SPOC Assigned', 'room', p_room_id, jsonb_build_object('spoc_profile_id', p_spoc_profile_id));
end;
$function$;
revoke all on function public.assign_spoc_to_room(uuid, uuid) from public, anon;
grant execute on function public.assign_spoc_to_room(uuid, uuid) to authenticated;

-- assign_team_to_room
CREATE OR REPLACE FUNCTION public.assign_team_to_room(p_team_id uuid, p_room_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_spoc uuid;
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then raise exception 'NOT_ALLOWED'; end if;

  if p_room_id is not null and (select campus from public.teams where id = p_team_id) is distinct from (select campus from public.rooms where id = p_room_id) then raise exception 'CROSS_CAMPUS'; end if;

  if p_room_id is null then
    update public.teams set room_id = null, spoc_profile_id = null, updated_at = now() where id = p_team_id;
    return;
  end if;

  select spoc_profile_id into v_spoc from public.rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  update public.teams set room_id = p_room_id, spoc_profile_id = v_spoc, updated_at = now() where id = p_team_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Team Assigned To Room', 'team', p_team_id, jsonb_build_object('room_id', p_room_id));
end;
$function$;
revoke all on function public.assign_team_to_room(uuid, uuid) from public, anon;
grant execute on function public.assign_team_to_room(uuid, uuid) to authenticated;

-- assign_zone_manager
CREATE OR REPLACE FUNCTION public.assign_zone_manager(p_zone_id uuid, p_manager_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then raise exception 'NOT_ALLOWED'; end if;
  if p_manager_profile_id is not null and (select campus from public.profiles where id = p_manager_profile_id) is distinct from (select campus from public.zones where id = p_zone_id) then raise exception 'CROSS_CAMPUS'; end if;

  update public.zones set zone_manager_profile_id = p_manager_profile_id, updated_at = now() where id = p_zone_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Zone Manager Assigned', 'zone', p_zone_id, jsonb_build_object('manager_profile_id', p_manager_profile_id));
end;
$function$;
revoke all on function public.assign_zone_manager(uuid, uuid) from public, anon;
grant execute on function public.assign_zone_manager(uuid, uuid) to authenticated;

-- broadcast_notification
CREATE OR REPLACE FUNCTION public.broadcast_notification(p_title text, p_message text, p_audience_type text, p_audience_value text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_count integer;
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then raise exception 'NOT_ALLOWED'; end if;
  if trim(p_title) = '' or trim(p_message) = '' then raise exception 'INVALID_BROADCAST'; end if;

  if p_audience_type = 'all' then
    insert into public.notifications (recipient_profile_id, type, title, message)
    select id, 'AdminBroadcast', p_title, p_message
    from public.profiles
    where role in ('Member', 'Team Lead', 'SPOC') and (public.is_platform_admin() or campus = public.current_campus());

  elsif p_audience_type = 'role' then
    if p_audience_value not in ('Member', 'Team Lead', 'SPOC') then raise exception 'INVALID_AUDIENCE'; end if;

    insert into public.notifications (recipient_profile_id, type, title, message)
    select id, 'AdminBroadcast', p_title, p_message
    from public.profiles
    where role = p_audience_value::public.user_role and (public.is_platform_admin() or campus = public.current_campus());

  elsif p_audience_type = 'venue' then
    if not exists (select 1 from public.rooms where id = p_audience_value::uuid) then
      raise exception 'ROOM_NOT_FOUND';
    end if;

    insert into public.notifications (recipient_profile_id, type, title, message)
    select tm.profile_id, 'AdminBroadcast', p_title, p_message
    from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where t.room_id = p_audience_value::uuid and (public.is_platform_admin() or t.campus = public.current_campus());

  else
    raise exception 'INVALID_AUDIENCE';
  end if;

  get diagnostics v_count = row_count;

  insert into public.audit_logs (actor_profile_id, action, entity_type, new_value)
  values (
    public.current_profile_id(), 'Notification Broadcast', 'notification',
    jsonb_build_object(
      'audience_type', p_audience_type, 'audience_value', p_audience_value,
      'title', p_title, 'recipient_count', v_count
    )
  );

  return v_count;
end;
$function$;
revoke all on function public.broadcast_notification(text, text, text, text) from public, anon;
grant execute on function public.broadcast_notification(text, text, text, text) to authenticated;

-- change_team_lead
CREATE OR REPLACE FUNCTION public.change_team_lead(p_team_id uuid, p_new_lead_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_old_lead_profile_id uuid;
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then raise exception 'NOT_ALLOWED'; end if;
  if not public.is_platform_admin() and ((select campus from public.teams where id = p_team_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  if not exists (
    select 1 from public.team_members where team_id = p_team_id and profile_id = p_new_lead_profile_id
  ) then
    raise exception 'PARTICIPANT_NOT_FOUND';
  end if;

  select profile_id into v_old_lead_profile_id
  from public.team_members where team_id = p_team_id and is_lead = true;

  if v_old_lead_profile_id = p_new_lead_profile_id then
    raise exception 'ALREADY_LEAD';
  end if;

  update public.team_members set is_lead = false where team_id = p_team_id and is_lead = true;
  update public.team_members set is_lead = true where team_id = p_team_id and profile_id = p_new_lead_profile_id;

  update public.teams set team_lead_profile_id = p_new_lead_profile_id, updated_at = now() where id = p_team_id;

  update public.profiles set role = 'Team Lead', updated_at = now() where id = p_new_lead_profile_id;
  if v_old_lead_profile_id is not null then
    update public.profiles set role = 'Member', updated_at = now() where id = v_old_lead_profile_id;
  end if;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, previous_value, new_value)
  values (
    public.current_profile_id(), 'Team Lead Changed', 'team', p_team_id,
    jsonb_build_object('lead_profile_id', v_old_lead_profile_id),
    jsonb_build_object('lead_profile_id', p_new_lead_profile_id)
  );

  insert into public.notifications (recipient_profile_id, type, title, message)
  values (p_new_lead_profile_id, 'TeamLeadChanged', 'You are now the Team Lead', 'A Super Admin made you this team''s Team Lead.');
end;
$function$;
revoke all on function public.change_team_lead(uuid, uuid) from public, anon;
grant execute on function public.change_team_lead(uuid, uuid) to authenticated;

-- create_attendance_session
CREATE OR REPLACE FUNCTION public.create_attendance_session(p_name text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_sort_order integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;

  insert into public.attendance_sessions (name, starts_at, ends_at, sort_order)
  values (p_name, p_starts_at, p_ends_at, coalesce(p_sort_order, 0))
  returning id into v_id;

  return v_id;
end;
$function$;
revoke all on function public.create_attendance_session(text, timestamp with time zone, timestamp with time zone, integer) from public, anon;
grant execute on function public.create_attendance_session(text, timestamp with time zone, timestamp with time zone, integer) to authenticated;

-- delete_exit_request
CREATE OR REPLACE FUNCTION public.delete_exit_request(p_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_led_profile(p_profile_id) or public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.is_platform_admin() and ((select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  delete from public.exit_requests where profile_id = p_profile_id;
end;
$function$;
revoke all on function public.delete_exit_request(uuid) from public, anon;
grant execute on function public.delete_exit_request(uuid) to authenticated;

-- delete_member
CREATE OR REPLACE FUNCTION public.delete_member(p_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then raise exception 'NOT_ALLOWED'; end if;
  if not public.is_platform_admin() and ((select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;
  if exists (select 1 from public.team_members where profile_id = p_profile_id and is_lead) then
    raise exception 'CANNOT_DELETE_LEAD';
  end if;

  update public.audit_logs set actor_profile_id = null where actor_profile_id = p_profile_id;
  delete from public.approval_requests where requested_by = p_profile_id;
  delete from public.problem_statement_selections where selected_by = p_profile_id;
  delete from public.exit_requests where profile_id = p_profile_id;

  -- Rows this profile acted on for someone else (e.g. as Team Lead) --
  -- these aren't "about" this profile so the profile_id-keyed deletes
  -- below never touch them.
  delete from public.noc_audit_log where performed_by = p_profile_id;
  update public.nocs set uploaded_by = null where uploaded_by = p_profile_id;
  update public.presentations set uploaded_by = null where uploaded_by = p_profile_id;

  delete from public.attendance where profile_id = p_profile_id;
  delete from public.food_coupons where profile_id = p_profile_id;
  delete from public.nocs where profile_id = p_profile_id;
  -- Cascades team_members (profile_id ON DELETE CASCADE).
  delete from public.profiles where id = p_profile_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'Member Deleted', 'profile', p_profile_id);
end;
$function$;
revoke all on function public.delete_member(uuid) from public, anon;
grant execute on function public.delete_member(uuid) to authenticated;

-- delete_noc
CREATE OR REPLACE FUNCTION public.delete_noc(p_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_noc_id uuid;
begin
  if not (
    public.is_led_profile(p_profile_id)
    or public.is_assigned_spoc_of_profile(p_profile_id)
    or public.current_role() = 'Campus Admin' or public.is_platform_admin()
  ) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.is_platform_admin() and ((select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  update public.nocs set status = 'Not Uploaded', file_path = null, updated_at = now()
  where profile_id = p_profile_id
  returning id into v_noc_id;

  if v_noc_id is not null then
    insert into public.noc_audit_log (noc_id, action, performed_by) values (v_noc_id, 'Deleted', public.current_profile_id());
  end if;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'NOC Deleted', 'noc', p_profile_id);
end;
$function$;
revoke all on function public.delete_noc(uuid) from public, anon;
grant execute on function public.delete_noc(uuid) to authenticated;

-- delete_presentation
CREATE OR REPLACE FUNCTION public.delete_presentation(p_team_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_led_team(p_team_id) or public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.is_platform_admin() and ((select campus from public.teams where id = p_team_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  update public.presentations set status = 'Not Uploaded', file_path = null where team_id = p_team_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'Presentation Deleted', 'presentation', p_team_id);
end;
$function$;
revoke all on function public.delete_presentation(uuid) from public, anon;
grant execute on function public.delete_presentation(uuid) to authenticated;

-- delete_spoc
CREATE OR REPLACE FUNCTION public.delete_spoc(p_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then raise exception 'NOT_ALLOWED'; end if;
  if not public.is_platform_admin() and ((select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile_id and role = 'SPOC') then
    raise exception 'NOT_A_SPOC';
  end if;

  update public.rooms set spoc_profile_id = null, updated_at = now() where spoc_profile_id = p_profile_id;
  update public.teams set spoc_profile_id = null, updated_at = now() where spoc_profile_id = p_profile_id;
  update public.zones set zone_manager_profile_id = null, updated_at = now() where zone_manager_profile_id = p_profile_id;
  delete from public.profiles where id = p_profile_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'SPOC Deleted', 'profile', p_profile_id);
end;
$function$;
revoke all on function public.delete_spoc(uuid) from public, anon;
grant execute on function public.delete_spoc(uuid) to authenticated;

-- delete_team
CREATE OR REPLACE FUNCTION public.delete_team(p_team_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_profile_id uuid;
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then raise exception 'NOT_ALLOWED'; end if;
  if not public.is_platform_admin() and ((select campus from public.teams where id = p_team_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;
  if not exists (select 1 from public.teams where id = p_team_id) then raise exception 'TEAM_NOT_FOUND'; end if;

  update public.teams set team_lead_profile_id = null where id = p_team_id;

  update public.audit_logs set actor_profile_id = null
  where actor_profile_id in (select profile_id from public.team_members where team_id = p_team_id);

  delete from public.approval_requests where team_id = p_team_id;
  delete from public.problem_statement_selections where team_id = p_team_id;
  delete from public.exit_requests where team_id = p_team_id;

  for v_profile_id in select profile_id from public.team_members where team_id = p_team_id loop
    delete from public.attendance where profile_id = v_profile_id;
    delete from public.food_coupons where profile_id = v_profile_id;
    delete from public.nocs where profile_id = v_profile_id;
  end loop;

  delete from public.exit_forms where team_id = p_team_id;
  delete from public.presentations where team_id = p_team_id;

  delete from public.profiles where id in (select profile_id from public.team_members where team_id = p_team_id);

  delete from public.teams where id = p_team_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'Team Deleted', 'team', p_team_id);
end;
$function$;
revoke all on function public.delete_team(uuid) from public, anon;
grant execute on function public.delete_team(uuid) to authenticated;

-- extend_noc_deadline
CREATE OR REPLACE FUNCTION public.extend_noc_deadline(p_profile_id uuid, p_deadline timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_assigned_spoc_of_profile(p_profile_id) or public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.is_platform_admin() and ((select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  insert into public.nocs (profile_id, deadline) values (p_profile_id, p_deadline)
  on conflict (profile_id) do update set deadline = excluded.deadline, updated_at = now();
end;
$function$;
revoke all on function public.extend_noc_deadline(uuid, timestamp with time zone) from public, anon;
grant execute on function public.extend_noc_deadline(uuid, timestamp with time zone) to authenticated;

-- extend_presentation_deadline
CREATE OR REPLACE FUNCTION public.extend_presentation_deadline(p_team_id uuid, p_deadline timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_assigned_spoc_of_team(p_team_id) or public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.is_platform_admin() and ((select campus from public.teams where id = p_team_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  insert into public.presentations (team_id, deadline) values (p_team_id, p_deadline)
  on conflict (team_id) do update set deadline = excluded.deadline;

  insert into public.notifications (recipient_profile_id, type, title, message)
  select tm.profile_id, 'PresentationDeadlineExtended', 'Presentation deadline extended',
         'Your team''s presentation submission deadline has been extended.'
  from public.team_members tm
  where tm.team_id = p_team_id and tm.is_lead = true;
end;
$function$;
revoke all on function public.extend_presentation_deadline(uuid, timestamp with time zone) from public, anon;
grant execute on function public.extend_presentation_deadline(uuid, timestamp with time zone) to authenticated;

-- extend_problem_statement_deadline
CREATE OR REPLACE FUNCTION public.extend_problem_statement_deadline(p_team_id uuid, p_extended_until timestamp with time zone, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_assigned_spoc_of_team(p_team_id) or public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.is_platform_admin() and ((select campus from public.teams where id = p_team_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  insert into public.problem_statement_extensions (team_id, extended_until, reason, granted_by)
  values (p_team_id, p_extended_until, p_reason, public.current_profile_id())
  on conflict (team_id) do update
    set extended_until = excluded.extended_until, reason = excluded.reason,
        granted_by = excluded.granted_by, granted_at = now();

  insert into public.notifications (recipient_profile_id, type, title, message)
  select team_lead_profile_id, 'ProblemStatementDeadlineExtended', 'Selection deadline extended',
         'Your team''s problem statement selection deadline has been extended.'
  from public.teams where id = p_team_id;
end;
$function$;
revoke all on function public.extend_problem_statement_deadline(uuid, timestamp with time zone, text) from public, anon;
grant execute on function public.extend_problem_statement_deadline(uuid, timestamp with time zone, text) to authenticated;

-- record_attendance
CREATE OR REPLACE FUNCTION public.record_attendance(p_session_id uuid, p_profile_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_team_id uuid;
  v_existing_id uuid;
  v_previous_status public.attendance_status;
begin
  select team_id into v_team_id from public.team_members where profile_id = p_profile_id;
  if v_team_id is null then
    raise exception 'PARTICIPANT_NOT_FOUND';
  end if;
  if not (public.is_assigned_spoc_of_team(v_team_id) or public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.is_platform_admin() and ((select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  select id, status into v_existing_id, v_previous_status
    from public.attendance where session_id = p_session_id and profile_id = p_profile_id;

  if v_existing_id is null then
    insert into public.attendance (session_id, profile_id, team_id, status, recorded_by)
    values (p_session_id, p_profile_id, v_team_id, p_status::public.attendance_status, public.current_profile_id());
  else
    update public.attendance
       set status = p_status::public.attendance_status, recorded_by = public.current_profile_id(), recorded_at = now()
     where id = v_existing_id;

    -- SPEC §49: every modification recorded (previous status, new status, who, when)
    if v_previous_status is distinct from p_status::public.attendance_status then
      insert into public.attendance_audit_log (attendance_id, previous_status, new_status, modified_by)
      values (v_existing_id, v_previous_status, p_status::public.attendance_status, public.current_profile_id());
    end if;
  end if;
end;
$function$;
revoke all on function public.record_attendance(uuid, uuid, text) from public, anon;
grant execute on function public.record_attendance(uuid, uuid, text) to authenticated;

-- record_exit_form
CREATE OR REPLACE FUNCTION public.record_exit_form(p_team_id uuid, p_file_path text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_led_team(p_team_id) then
    raise exception 'NOT_TEAM_LEAD';
  end if;

  insert into public.exit_forms (team_id, file_path, status, uploaded_by, uploaded_at)
  values (p_team_id, p_file_path, 'Submitted', public.current_profile_id(), now())
  on conflict (team_id) do update
    set file_path = excluded.file_path, status = 'Submitted',
        uploaded_by = excluded.uploaded_by, uploaded_at = excluded.uploaded_at;

  insert into public.notifications (recipient_profile_id, type, title, message)
  select id, 'ExitFormUploaded', 'Exit form uploaded', 'A team exit form was uploaded.'
  from public.profiles
  where ((role = 'Campus Admin' and campus = (select campus from public.teams where id = p_team_id)) or role = 'Super Admin')
     or id = (select spoc_profile_id from public.teams where id = p_team_id);
end;
$function$;
revoke all on function public.record_exit_form(uuid, text) from public, anon;
grant execute on function public.record_exit_form(uuid, text) to authenticated;

-- record_food_redemption
CREATE OR REPLACE FUNCTION public.record_food_redemption(p_profile_id uuid, p_meal text, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_team_id uuid;
begin
  if p_meal not in ('lunch', 'dinner') then
    raise exception 'INVALID_MEAL';
  end if;

  select team_id into v_team_id from public.team_members where profile_id = p_profile_id;
  if v_team_id is null then
    raise exception 'PARTICIPANT_NOT_FOUND';
  end if;
  if not (public.is_assigned_spoc_of_team(v_team_id) or public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.is_platform_admin() and ((select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  insert into public.food_coupons (profile_id, lunch_status, dinner_status)
  values (p_profile_id, 'Not Redeemed', 'Not Redeemed')
  on conflict (profile_id) do nothing;

  if p_meal = 'lunch' then
    update public.food_coupons
       set lunch_status = p_status::public.meal_status, lunch_recorded_by = public.current_profile_id(), lunch_recorded_at = now()
     where profile_id = p_profile_id;
  else
    update public.food_coupons
       set dinner_status = p_status::public.meal_status, dinner_recorded_by = public.current_profile_id(), dinner_recorded_at = now()
     where profile_id = p_profile_id;
  end if;
end;
$function$;
revoke all on function public.record_food_redemption(uuid, text, text) from public, anon;
grant execute on function public.record_food_redemption(uuid, text, text) to authenticated;

-- record_noc_metadata
CREATE OR REPLACE FUNCTION public.record_noc_metadata(p_profile_id uuid, p_file_path text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_action text;
  v_noc_id uuid;
  v_deadline timestamptz;
begin
  if not (public.is_own_or_led_profile(p_profile_id) or public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.is_platform_admin() and (public.current_role() = 'Campus Admin' and (select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  select deadline into v_deadline from public.nocs where profile_id = p_profile_id;
  if v_deadline is null then
    select (value #>> '{}')::timestamptz into v_deadline
    from public.configuration where key = 'noc.general_deadline';
  end if;
  if v_deadline is not null and now() > v_deadline and not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'DEADLINE_PASSED';
  end if;

  v_action := case when exists (select 1 from public.nocs where profile_id = p_profile_id) then 'Replaced' else 'Uploaded' end;

  insert into public.nocs (profile_id, file_path, status, uploaded_by, uploaded_at)
  values (p_profile_id, p_file_path, 'Uploaded', public.current_profile_id(), now())
  on conflict (profile_id) do update
    set file_path = excluded.file_path, status = 'Uploaded',
        uploaded_by = excluded.uploaded_by, uploaded_at = excluded.uploaded_at, updated_at = now()
  returning id into v_noc_id;

  insert into public.noc_audit_log (noc_id, action, performed_by) values (v_noc_id, v_action, public.current_profile_id());

  insert into public.notifications (recipient_profile_id, type, title, message)
  select tm.profile_id, 'NocUploaded', 'NOC uploaded', 'A team NOC was uploaded.'
  from public.team_members tm
  where tm.team_id = (select team_id from public.team_members where profile_id = p_profile_id) and tm.is_lead = true;
end;
$function$;
revoke all on function public.record_noc_metadata(uuid, text) from public, anon;
grant execute on function public.record_noc_metadata(uuid, text) to authenticated;

-- record_presentation
CREATE OR REPLACE FUNCTION public.record_presentation(p_team_id uuid, p_file_path text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_deadline timestamptz;
begin
  if not (
    public.is_led_team(p_team_id)
    or (public.current_role() = 'Campus Admin' and public.is_same_campus_team(p_team_id)) or public.is_platform_admin()
  ) then
    raise exception 'NOT_TEAM_LEAD';
  end if;

  select deadline into v_deadline from public.presentations where team_id = p_team_id;
  if v_deadline is null then
    select (value #>> '{}')::timestamptz into v_deadline
    from public.configuration where key = 'ppt.general_deadline';
  end if;

  if v_deadline is not null and now() > v_deadline and not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'DEADLINE_PASSED';
  end if;

  insert into public.presentations (team_id, file_path, status, uploaded_by, uploaded_at)
  values (p_team_id, p_file_path, 'Uploaded', public.current_profile_id(), now())
  on conflict (team_id) do update
    set file_path = excluded.file_path, status = 'Uploaded',
        uploaded_by = excluded.uploaded_by, uploaded_at = excluded.uploaded_at;

  insert into public.notifications (recipient_profile_id, type, title, message)
  select id, 'PresentationUploaded', 'Presentation uploaded', 'A team presentation (PPT) was uploaded.'
  from public.profiles
  where ((role = 'Campus Admin' and campus = (select campus from public.teams where id = p_team_id)) or role = 'Super Admin')
     or id = (select spoc_profile_id from public.teams where id = p_team_id);
end;
$function$;
revoke all on function public.record_presentation(uuid, text) from public, anon;
grant execute on function public.record_presentation(uuid, text) to authenticated;

-- request_member_exit
CREATE OR REPLACE FUNCTION public.request_member_exit(p_profile_id uuid, p_file_path text, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_team_id uuid;
begin
  if not public.is_own_or_led_profile(p_profile_id) then raise exception 'NOT_ALLOWED'; end if;

  select team_id into v_team_id from public.team_members where profile_id = p_profile_id;
  if v_team_id is null then raise exception 'PARTICIPANT_NOT_FOUND'; end if;

  insert into public.exit_requests (profile_id, team_id, file_path, status, reason, requested_at, reviewed_by, reviewed_at)
  values (p_profile_id, v_team_id, p_file_path, 'Requested', p_reason, now(), null, null)
  on conflict (profile_id) do update
    set team_id = excluded.team_id, file_path = excluded.file_path, status = 'Requested',
        reason = excluded.reason, requested_at = now(), reviewed_by = null, reviewed_at = null;

  insert into public.notifications (recipient_profile_id, type, title, message)
  select id, 'MemberExitRequested', 'Exit request submitted', 'A team member has requested to exit the event.'
  from public.profiles
  where ((role = 'Campus Admin' and campus = (select campus from public.teams where id = v_team_id)) or role = 'Super Admin')
     or id = (select spoc_profile_id from public.teams where id = v_team_id);
end;
$function$;
revoke all on function public.request_member_exit(uuid, text, text) from public, anon;
grant execute on function public.request_member_exit(uuid, text, text) to authenticated;

-- resolve_approval_request
CREATE OR REPLACE FUNCTION public.resolve_approval_request(p_request_id uuid, p_decision text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_team_id uuid;
  v_status public.approval_status;
  v_requested_changes jsonb;
  v_requested_by uuid;
  v_member jsonb;
  v_team_name text;
  v_cur public.profiles%rowtype;
begin
  if p_decision not in ('Approved', 'Rejected') then
    raise exception 'INVALID_DECISION';
  end if;

  select team_id, status, requested_changes, requested_by
    into v_team_id, v_status, v_requested_changes, v_requested_by
  from public.approval_requests where id = p_request_id;

  if v_team_id is null then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if v_status <> 'Pending' then
    raise exception 'ALREADY_RESOLVED';
  end if;
  if not (public.is_assigned_spoc_of_team(v_team_id) or public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.is_platform_admin() and ((select t.campus from public.approval_requests ar join public.teams t on t.id = ar.team_id where ar.id = p_request_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  if p_decision = 'Approved' then
    v_team_name := v_requested_changes->'team'->>'teamName';
    if v_team_name is not null then
      update public.teams set team_name = v_team_name where id = v_team_id;
    end if;

    for v_member in select * from jsonb_array_elements(coalesce(v_requested_changes->'members', '[]'::jsonb)) loop
      select * into v_cur from public.profiles where id = (v_member->>'profileId')::uuid;

      perform public.validate_member_academics(
        coalesce(nullif(btrim(v_member->>'name'), ''), v_cur.name, 'This member'),
        coalesce(v_member->>'name', v_cur.name),
        v_cur.reg_no,
        v_cur.gitam_email::text,
        coalesce(v_member->>'phone', v_cur.phone),
        coalesce(v_member->>'graduation', v_cur.graduation),
        coalesce(v_member->>'program', v_cur.program),
        coalesce(v_member->>'yearOfStudy', v_cur.year_of_study),
        coalesce(v_member->>'school', v_cur.school),
        coalesce(v_member->>'department', v_cur.department),
        coalesce(v_member->>'branch', v_cur.branch),
        coalesce(v_member->>'gender', v_cur.gender),
        coalesce(v_member->>'stay', v_cur.stay),
        false
      );

      update public.profiles set
        name = coalesce(v_member->>'name', name),
        phone = coalesce(v_member->>'phone', phone),
        graduation = coalesce(v_member->>'graduation', graduation),
        program = coalesce(v_member->>'program', program),
        year_of_study = coalesce(v_member->>'yearOfStudy', year_of_study),
        school = coalesce(v_member->>'school', school),
        department = coalesce(v_member->>'department', department),
        branch = coalesce(v_member->>'branch', branch),
        gender = coalesce(v_member->>'gender', gender),
        stay = coalesce(v_member->>'stay', stay),
        updated_at = now()
      where id = (v_member->>'profileId')::uuid;
    end loop;
  end if;

  update public.approval_requests
     set status = p_decision::public.approval_status, reviewed_by = public.current_profile_id(), reviewed_at = now()
   where id = p_request_id;

  update public.teams set status = 'Registered', updated_at = now() where id = v_team_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (
    public.current_profile_id(),
    case when p_decision = 'Approved' then 'Team Edit Approved' else 'Team Edit Rejected' end,
    'team', v_team_id, v_requested_changes
  );

  insert into public.notifications (recipient_profile_id, type, title, message)
  values (
    v_requested_by,
    case when p_decision = 'Approved' then 'TeamEditApproved' else 'TeamEditRejected' end,
    case when p_decision = 'Approved' then 'Team edit approved' else 'Team edit rejected' end,
    case when p_decision = 'Approved' then 'Your requested team changes have been approved.'
         else 'Your requested team changes were rejected — your previous info is unchanged.' end
  );
end;
$function$;
revoke all on function public.resolve_approval_request(uuid, text) from public, anon;
grant execute on function public.resolve_approval_request(uuid, text) to authenticated;

-- resolve_member_exit
CREATE OR REPLACE FUNCTION public.resolve_member_exit(p_request_id uuid, p_decision text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_profile_id uuid; v_team_id uuid;
begin
  if p_decision not in ('Approved', 'Rejected') then raise exception 'INVALID_DECISION'; end if;

  select profile_id, team_id into v_profile_id, v_team_id from public.exit_requests where id = p_request_id;
  if v_profile_id is null then raise exception 'REQUEST_NOT_FOUND'; end if;

  if not (public.is_assigned_spoc_of_team(v_team_id) or public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.is_platform_admin() and ((select t.campus from public.exit_requests er join public.teams t on t.id = er.team_id where er.id = p_request_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  update public.exit_requests
  set status = p_decision::public.member_exit_status, reviewed_by = public.current_profile_id(), reviewed_at = now()
  where id = p_request_id;

  if p_decision = 'Approved' then
    update public.profiles set is_active = false, deactivated_at = now() where id = v_profile_id;
  end if;

  insert into public.notifications (recipient_profile_id, type, title, message)
  values (
    v_profile_id,
    case when p_decision = 'Approved' then 'MemberExitApproved' else 'MemberExitRejected' end,
    case when p_decision = 'Approved' then 'Exit request approved' else 'Exit request rejected' end,
    case when p_decision = 'Approved' then 'Your exit request has been approved — your registration is now exited.'
         else 'Your exit request was rejected — you remain an active participant.' end
  );
end;
$function$;
revoke all on function public.resolve_member_exit(uuid, text) from public, anon;
grant execute on function public.resolve_member_exit(uuid, text) to authenticated;

-- seed_campus_super_admin
CREATE OR REPLACE FUNCTION public.seed_campus_super_admin(p_campus campus, p_email text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid;
begin
  if exists (select 1 from public.profiles where gitam_email = lower(p_email)) then
    return null;  -- idempotent: already seeded
  end if;
  insert into public.profiles (user_id, campus, role, name, gitam_email)
  values (public.next_user_id(p_campus::text), p_campus, 'Campus Admin',
          'Super Admin (' || p_campus::text || ')', lower(p_email))
  returning id into v_id;
  return v_id;
end;
$function$;
revoke all on function public.seed_campus_super_admin(campus, text) from public, anon;
grant execute on function public.seed_campus_super_admin(campus, text) to authenticated;

-- set_configuration
CREATE OR REPLACE FUNCTION public.set_configuration(p_key text, p_value jsonb, p_description text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;

  insert into public.configuration (key, value, description, updated_by, updated_at)
  values (p_key, p_value, p_description, public.current_profile_id(), now())
  on conflict (key) do update
    set value = excluded.value,
        description = coalesce(excluded.description, public.configuration.description),
        updated_by = excluded.updated_by, updated_at = now();
end;
$function$;
revoke all on function public.set_configuration(text, jsonb, text) from public, anon;
grant execute on function public.set_configuration(text, jsonb, text) to authenticated;

-- submit_team_edit_request
CREATE OR REPLACE FUNCTION public.submit_team_edit_request(p_team_id uuid, p_current_snapshot jsonb, p_requested_changes jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_request_id uuid;
begin
  if not public.is_led_team(p_team_id) then
    raise exception 'NOT_TEAM_LEAD';
  end if;

  if exists (select 1 from public.approval_requests where team_id = p_team_id and status = 'Pending') then
    raise exception 'REQUEST_ALREADY_PENDING';
  end if;

  insert into public.approval_requests (team_id, current_snapshot, requested_changes, requested_by, status)
  values (p_team_id, p_current_snapshot, p_requested_changes, public.current_profile_id(), 'Pending')
  returning id into v_request_id;

  -- SPEC §23: team status auto-updates; resolve_approval_request (0003)
  -- reverts this back to 'Registered' once the request is resolved either way.
  update public.teams set status = 'Pending Approval', updated_at = now() where id = p_team_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, previous_value, new_value)
  values (public.current_profile_id(), 'Team Edit Requested', 'team', p_team_id, p_current_snapshot, p_requested_changes);

  insert into public.notifications (recipient_profile_id, type, title, message)
  select id, 'TeamEditRequested', 'New team edit request', 'A team edit request needs review.'
  from public.profiles
  where ((role = 'Campus Admin' and campus = (select campus from public.teams where id = p_team_id)) or role = 'Super Admin')
     or id = (select spoc_profile_id from public.teams where id = p_team_id);

  return v_request_id;
exception
  when unique_violation then
    raise exception 'REQUEST_ALREADY_PENDING';
end;
$function$;
revoke all on function public.submit_team_edit_request(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.submit_team_edit_request(uuid, jsonb, jsonb) to authenticated;

-- update_member
CREATE OR REPLACE FUNCTION public.update_member(p_profile_id uuid, p_name text, p_gitam_email text, p_phone text, p_reg_no text, p_graduation text, p_program text, p_year_of_study text, p_school text, p_department text, p_branch text, p_gender text, p_stay text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then raise exception 'NOT_ALLOWED'; end if;
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'PARTICIPANT_NOT_FOUND';
  end if;
  if not public.is_platform_admin() and ((select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  if exists (select 1 from public.profiles where gitam_email = lower(p_gitam_email) and id <> p_profile_id) then
    raise exception 'DUPLICATE_EMAIL:%', p_gitam_email;
  end if;
  if exists (select 1 from public.profiles where reg_no = p_reg_no and id <> p_profile_id) then
    raise exception 'DUPLICATE_REGNO:%', p_reg_no;
  end if;
  if exists (select 1 from public.profiles where phone = p_phone and id <> p_profile_id) then
    raise exception 'DUPLICATE_PHONE:%', p_phone;
  end if;

  perform public.validate_member_academics(
    coalesce(nullif(btrim(p_name), ''), 'This member'),
    p_name, p_reg_no, p_gitam_email, p_phone,
    p_graduation, p_program, p_year_of_study,
    p_school, p_department, p_branch, p_gender, p_stay, true
  );

  update public.profiles set
    name = p_name,
    gitam_email = lower(p_gitam_email),
    phone = p_phone,
    reg_no = p_reg_no,
    graduation = p_graduation,
    program = p_program,
    year_of_study = p_year_of_study,
    school = p_school,
    department = p_department,
    branch = p_branch,
    gender = p_gender,
    stay = p_stay,
    updated_at = now()
  where id = p_profile_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (
    public.current_profile_id(), 'Member Updated', 'profile', p_profile_id,
    jsonb_build_object('name', p_name, 'gitam_email', lower(p_gitam_email))
  );
end;
$function$;
revoke all on function public.update_member(uuid, text, text, text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.update_member(uuid, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;

-- update_team_name
CREATE OR REPLACE FUNCTION public.update_team_name(p_team_id uuid, p_team_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then raise exception 'NOT_ALLOWED'; end if;
  if not public.is_platform_admin() and ((select campus from public.teams where id = p_team_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;
  if not exists (select 1 from public.teams where id = p_team_id) then raise exception 'TEAM_NOT_FOUND'; end if;
  if exists (select 1 from public.teams where team_name = p_team_name and id <> p_team_id) then
    raise exception 'DUPLICATE_TEAM_NAME';
  end if;

  update public.teams set team_name = p_team_name, updated_at = now() where id = p_team_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Team Renamed', 'team', p_team_id, jsonb_build_object('team_name', p_team_name));
end;
$function$;
revoke all on function public.update_team_name(uuid, text) from public, anon;
grant execute on function public.update_team_name(uuid, text) to authenticated;

-- update_user_role
CREATE OR REPLACE FUNCTION public.update_user_role(p_profile_id uuid, p_new_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_previous_role public.user_role;
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_new_role in ('Super Admin', 'Campus Admin') and not public.is_platform_admin() then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.is_platform_admin() and ((select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  select role into v_previous_role from public.profiles where id = p_profile_id;

  update public.profiles set role = p_new_role::public.user_role, updated_at = now() where id = p_profile_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, previous_value, new_value)
  values (public.current_profile_id(), 'User Role Changed', 'profile', p_profile_id,
          jsonb_build_object('role', v_previous_role), jsonb_build_object('role', p_new_role));
end;
$function$;
revoke all on function public.update_user_role(uuid, text) from public, anon;
grant execute on function public.update_user_role(uuid, text) to authenticated;

-- upsert_problem_statement
CREATE OR REPLACE FUNCTION public.upsert_problem_statement(p_id uuid, p_number text, p_title text, p_description text, p_status text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_status not in ('Hidden', 'Released') then
    raise exception 'INVALID_STATUS';
  end if;

  if p_id is null then
    insert into public.problem_statements (number, title, description, status)
    values (p_number, p_title, p_description, p_status::public.ps_status)
    returning id into v_id;
  else
    update public.problem_statements
       set number = p_number, title = p_title, description = p_description,
           status = p_status::public.ps_status, updated_at = now()
     where id = p_id
     returning id into v_id;
  end if;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Problem Statement Changed', 'problem_statement', v_id,
          jsonb_build_object('number', p_number, 'title', p_title, 'status', p_status));

  return v_id;
exception
  when unique_violation then
    raise exception 'DUPLICATE_PS_NUMBER';
end;
$function$;
revoke all on function public.upsert_problem_statement(uuid, text, text, text, text) from public, anon;
grant execute on function public.upsert_problem_statement(uuid, text, text, text, text) to authenticated;

-- create_room / create_zone: optional p_campus for the platform admin
drop function if exists public.create_room(text, uuid);
create or replace function public.create_room(p_name text, p_zone_id uuid, p_campus text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_campus public.campus;
begin
  if public.is_platform_admin() then
    if p_campus is null then raise exception 'CAMPUS_REQUIRED'; end if;
    if p_campus not in ('VSP','BLR','HYD') then raise exception 'INVALID_CAMPUS'; end if;
    v_campus := p_campus::public.campus;
  elsif public.current_role() = 'Campus Admin' then
    v_campus := public.current_campus();
  else
    raise exception 'NOT_ALLOWED';
  end if;
  insert into public.rooms (name, zone_id, campus) values (p_name, p_zone_id, v_campus) returning id into v_id;
  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Room Created', 'room', v_id, jsonb_build_object('name', p_name));
  return v_id;
exception when unique_violation then raise exception 'DUPLICATE_ROOM_NAME';
end;
$$;
revoke all on function public.create_room(text, uuid, text) from public, anon;
grant execute on function public.create_room(text, uuid, text) to authenticated;

drop function if exists public.create_zone(text, uuid);
create or replace function public.create_zone(p_name text, p_manager_profile_id uuid, p_campus text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_campus public.campus;
begin
  if public.is_platform_admin() then
    if p_campus is null then raise exception 'CAMPUS_REQUIRED'; end if;
    if p_campus not in ('VSP','BLR','HYD') then raise exception 'INVALID_CAMPUS'; end if;
    v_campus := p_campus::public.campus;
  elsif public.current_role() = 'Campus Admin' then
    v_campus := public.current_campus();
  else
    raise exception 'NOT_ALLOWED';
  end if;
  insert into public.zones (name, zone_manager_profile_id, campus)
  values (p_name, p_manager_profile_id, v_campus) returning id into v_id;
  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Zone Created', 'zone', v_id, jsonb_build_object('name', p_name));
  return v_id;
exception when unique_violation then raise exception 'DUPLICATE_ZONE_NAME';
end;
$$;
revoke all on function public.create_zone(text, uuid, text) from public, anon;
grant execute on function public.create_zone(text, uuid, text) to authenticated;

-- staff creation split: create_staff_profile -> create_campus_admin + create_spoc
drop function if exists public.create_staff_profile(text, text, text);

create or replace function public.create_campus_admin(p_name text, p_email text, p_campus text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_platform_admin() then raise exception 'NOT_ALLOWED'; end if;
  if p_campus not in ('VSP','BLR','HYD') then raise exception 'INVALID_CAMPUS'; end if;
  if exists (select 1 from public.profiles where gitam_email = lower(p_email)) then
    raise exception 'DUPLICATE_EMAIL:%', p_email;
  end if;
  insert into public.profiles (user_id, campus, role, name, gitam_email)
  values (public.next_user_id(p_campus), p_campus::public.campus, 'Campus Admin', p_name, lower(p_email))
  returning id into v_id;
  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Staff Account Created', 'profile', v_id,
          jsonb_build_object('role', 'Campus Admin', 'email', p_email, 'campus', p_campus));
  return v_id;
end;
$$;
revoke all on function public.create_campus_admin(text, text, text) from public, anon;
grant execute on function public.create_campus_admin(text, text, text) to authenticated;

create or replace function public.create_spoc(p_name text, p_email text, p_campus text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_campus public.campus;
begin
  if public.is_platform_admin() then
    if p_campus is null then raise exception 'CAMPUS_REQUIRED'; end if;
    if p_campus not in ('VSP','BLR','HYD') then raise exception 'INVALID_CAMPUS'; end if;
    v_campus := p_campus::public.campus;
  elsif public.current_role() = 'Campus Admin' then
    v_campus := public.current_campus();
  else
    raise exception 'NOT_ALLOWED';
  end if;
  if exists (select 1 from public.profiles where gitam_email = lower(p_email)) then
    raise exception 'DUPLICATE_EMAIL:%', p_email;
  end if;
  insert into public.profiles (user_id, campus, role, name, gitam_email)
  values (public.next_user_id(v_campus::text), v_campus, 'SPOC', p_name, lower(p_email))
  returning id into v_id;
  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Staff Account Created', 'profile', v_id,
          jsonb_build_object('role', 'SPOC', 'email', p_email, 'campus', v_campus));
  return v_id;
end;
$$;
revoke all on function public.create_spoc(text, text, text) from public, anon;
grant execute on function public.create_spoc(text, text, text) to authenticated;


-- 33 policies: platform-admin bypass

drop policy if exists approval_requests_select on public.approval_requests;
create policy approval_requests_select on public.approval_requests as permissive for SELECT to authenticated
  using ((((team_id = current_team_id()) OR (team_id IN ( SELECT teams.id
   FROM teams
  WHERE (teams.spoc_profile_id = current_profile_id()))) OR (("current_role"() = 'Campus Admin'::user_role) AND (( SELECT t.campus
   FROM teams t
  WHERE (t.id = approval_requests.team_id)) = current_campus())))) or public.is_platform_admin());

drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance as permissive for SELECT to authenticated
  using ((((team_id = current_team_id()) OR (team_id IN ( SELECT teams.id
   FROM teams
  WHERE (teams.spoc_profile_id = current_profile_id()))) OR (("current_role"() = 'Campus Admin'::user_role) AND (( SELECT t.campus
   FROM teams t
  WHERE (t.id = attendance.team_id)) = current_campus())))) or public.is_platform_admin());

drop policy if exists attendance_audit_select on public.attendance_audit_log;
create policy attendance_audit_select on public.attendance_audit_log as permissive for SELECT to authenticated
  using ((((("current_role"() = 'Campus Admin'::user_role) AND (( SELECT t.campus
   FROM (attendance a
     JOIN teams t ON ((t.id = a.team_id)))
  WHERE (a.id = attendance_audit_log.attendance_id)) = current_campus())) OR (EXISTS ( SELECT 1
   FROM (attendance a
     JOIN teams t ON ((t.id = a.team_id)))
  WHERE ((a.id = attendance_audit_log.attendance_id) AND (t.spoc_profile_id = current_profile_id())))))) or public.is_platform_admin());

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs as permissive for SELECT to authenticated
  using (((("current_role"() = 'Campus Admin'::user_role) AND (( SELECT p.campus
   FROM profiles p
  WHERE (p.id = audit_logs.actor_profile_id)) = current_campus()))) or public.is_platform_admin());

drop policy if exists exit_forms_select on public.exit_forms;
create policy exit_forms_select on public.exit_forms as permissive for SELECT to authenticated
  using ((((team_id = current_team_id()) OR (team_id IN ( SELECT teams.id
   FROM teams
  WHERE (teams.spoc_profile_id = current_profile_id()))) OR (("current_role"() = 'Campus Admin'::user_role) AND (( SELECT t.campus
   FROM teams t
  WHERE (t.id = exit_forms.team_id)) = current_campus())))) or public.is_platform_admin());

drop policy if exists exit_requests_select on public.exit_requests;
create policy exit_requests_select on public.exit_requests as permissive for SELECT to authenticated
  using ((((profile_id = current_profile_id()) OR is_led_profile(profile_id) OR is_assigned_spoc_of_profile(profile_id) OR (("current_role"() = 'Campus Admin'::user_role) AND (( SELECT t.campus
   FROM teams t
  WHERE (t.id = exit_requests.team_id)) = current_campus())))) or public.is_platform_admin());

drop policy if exists food_coupons_select on public.food_coupons;
create policy food_coupons_select on public.food_coupons as permissive for SELECT to authenticated
  using ((((profile_id IN ( SELECT team_members.profile_id
   FROM team_members
  WHERE (team_members.team_id = current_team_id()))) OR (profile_id IN ( SELECT tm.profile_id
   FROM (team_members tm
     JOIN teams t ON ((t.id = tm.team_id)))
  WHERE (t.spoc_profile_id = current_profile_id()))) OR (("current_role"() = 'Campus Admin'::user_role) AND (( SELECT t.campus
   FROM (team_members tm
     JOIN teams t ON ((t.id = tm.team_id)))
  WHERE (tm.profile_id = food_coupons.profile_id)) = current_campus())))) or public.is_platform_admin());

drop policy if exists noc_audit_select on public.noc_audit_log;
create policy noc_audit_select on public.noc_audit_log as permissive for SELECT to authenticated
  using ((((("current_role"() = 'Campus Admin'::user_role) AND (( SELECT t.campus
   FROM ((nocs n
     JOIN team_members tm ON ((tm.profile_id = n.profile_id)))
     JOIN teams t ON ((t.id = tm.team_id)))
  WHERE (n.id = noc_audit_log.noc_id)) = current_campus())) OR (EXISTS ( SELECT 1
   FROM ((nocs n
     JOIN team_members tm ON ((tm.profile_id = n.profile_id)))
     JOIN teams t ON ((t.id = tm.team_id)))
  WHERE ((n.id = noc_audit_log.noc_id) AND ((("current_role"() = 'Team Lead'::user_role) AND (tm.team_id = current_team_id())) OR (t.spoc_profile_id = current_profile_id()))))))) or public.is_platform_admin());

drop policy if exists nocs_select on public.nocs;
create policy nocs_select on public.nocs as permissive for SELECT to authenticated
  using ((((profile_id = current_profile_id()) OR (("current_role"() = 'Team Lead'::user_role) AND (profile_id IN ( SELECT team_members.profile_id
   FROM team_members
  WHERE (team_members.team_id = current_team_id())))) OR (profile_id IN ( SELECT tm.profile_id
   FROM (team_members tm
     JOIN teams t ON ((t.id = tm.team_id)))
  WHERE (t.spoc_profile_id = current_profile_id()))) OR (("current_role"() = 'Campus Admin'::user_role) AND (( SELECT t.campus
   FROM (team_members tm
     JOIN teams t ON ((t.id = tm.team_id)))
  WHERE (tm.profile_id = nocs.profile_id)) = current_campus())))) or public.is_platform_admin());

drop policy if exists presentations_select on public.presentations;
create policy presentations_select on public.presentations as permissive for SELECT to authenticated
  using ((((team_id = current_team_id()) OR (team_id IN ( SELECT teams.id
   FROM teams
  WHERE (teams.spoc_profile_id = current_profile_id()))) OR (("current_role"() = 'Campus Admin'::user_role) AND (( SELECT t.campus
   FROM teams t
  WHERE (t.id = presentations.team_id)) = current_campus())))) or public.is_platform_admin());

drop policy if exists ps_extensions_select on public.problem_statement_extensions;
create policy ps_extensions_select on public.problem_statement_extensions as permissive for SELECT to authenticated
  using ((((team_id = current_team_id()) OR (team_id IN ( SELECT teams.id
   FROM teams
  WHERE (teams.spoc_profile_id = current_profile_id()))) OR (("current_role"() = 'Campus Admin'::user_role) AND (( SELECT t.campus
   FROM teams t
  WHERE (t.id = problem_statement_extensions.team_id)) = current_campus())))) or public.is_platform_admin());

drop policy if exists ps_selections_select on public.problem_statement_selections;
create policy ps_selections_select on public.problem_statement_selections as permissive for SELECT to authenticated
  using ((((team_id = current_team_id()) OR (team_id IN ( SELECT teams.id
   FROM teams
  WHERE (teams.spoc_profile_id = current_profile_id()))) OR (("current_role"() = 'Campus Admin'::user_role) AND (( SELECT t.campus
   FROM teams t
  WHERE (t.id = problem_statement_selections.team_id)) = current_campus())))) or public.is_platform_admin());

drop policy if exists problem_statements_select on public.problem_statements;
create policy problem_statements_select on public.problem_statements as permissive for SELECT to authenticated
  using ((((status = 'Released'::ps_status) OR ("current_role"() = ANY (ARRAY['SPOC'::user_role, 'Campus Admin'::user_role])))) or public.is_platform_admin());

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles as permissive for SELECT to authenticated
  using ((((auth_user_id = auth.uid()) OR (id IN ( SELECT team_members.profile_id
   FROM team_members
  WHERE (team_members.team_id = current_team_id()))) OR (id IN ( SELECT tm.profile_id
   FROM (team_members tm
     JOIN teams t ON ((t.id = tm.team_id)))
  WHERE (t.spoc_profile_id = current_profile_id()))) OR (("current_role"() = 'Campus Admin'::user_role) AND (campus = current_campus())))) or public.is_platform_admin());

drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms as permissive for SELECT to authenticated
  using (((campus = current_campus())) or public.is_platform_admin());

drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members as permissive for SELECT to authenticated
  using ((((team_id = current_team_id()) OR (team_id IN ( SELECT teams.id
   FROM teams
  WHERE (teams.spoc_profile_id = current_profile_id()))) OR (("current_role"() = 'Campus Admin'::user_role) AND (( SELECT t.campus
   FROM teams t
  WHERE (t.id = team_members.team_id)) = current_campus())))) or public.is_platform_admin());

drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams as permissive for SELECT to authenticated
  using ((((id = current_team_id()) OR (spoc_profile_id = current_profile_id()) OR (("current_role"() = 'Campus Admin'::user_role) AND (campus = current_campus())))) or public.is_platform_admin());

drop policy if exists zones_select on public.zones;
create policy zones_select on public.zones as permissive for SELECT to authenticated
  using (((campus = current_campus())) or public.is_platform_admin());

drop policy if exists exit_forms_delete_storage on storage.objects;
create policy exit_forms_delete_storage on storage.objects as permissive for DELETE to authenticated
  using ((((bucket_id = 'exit-forms'::text) AND (is_led_team(((storage.foldername(name))[1])::uuid) OR (("current_role"() = 'Campus Admin'::user_role) AND is_same_campus_team(((storage.foldername(name))[1])::uuid))))) or public.is_platform_admin());

drop policy if exists exit_forms_insert_storage on storage.objects;
create policy exit_forms_insert_storage on storage.objects as permissive for INSERT to authenticated
  with check ((((bucket_id = 'exit-forms'::text) AND (is_led_team(((storage.foldername(name))[1])::uuid) OR (("current_role"() = 'Campus Admin'::user_role) AND is_same_campus_team(((storage.foldername(name))[1])::uuid))))) or public.is_platform_admin());

drop policy if exists exit_forms_select_storage on storage.objects;
create policy exit_forms_select_storage on storage.objects as permissive for SELECT to authenticated
  using ((((bucket_id = 'exit-forms'::text) AND (is_own_team(((storage.foldername(name))[1])::uuid) OR is_assigned_spoc_of_team(((storage.foldername(name))[1])::uuid) OR (("current_role"() = 'Campus Admin'::user_role) AND is_same_campus_team(((storage.foldername(name))[1])::uuid))))) or public.is_platform_admin());

drop policy if exists exit_forms_update_storage on storage.objects;
create policy exit_forms_update_storage on storage.objects as permissive for UPDATE to authenticated
  using ((((bucket_id = 'exit-forms'::text) AND (is_led_team(((storage.foldername(name))[1])::uuid) OR (("current_role"() = 'Campus Admin'::user_role) AND is_same_campus_team(((storage.foldername(name))[1])::uuid))))) or public.is_platform_admin())
  with check ((((bucket_id = 'exit-forms'::text) AND (is_led_team(((storage.foldername(name))[1])::uuid) OR (("current_role"() = 'Campus Admin'::user_role) AND is_same_campus_team(((storage.foldername(name))[1])::uuid))))) or public.is_platform_admin());

drop policy if exists exit_requests_delete_storage on storage.objects;
create policy exit_requests_delete_storage on storage.objects as permissive for DELETE to authenticated
  using ((((bucket_id = 'exit-requests'::text) AND (is_led_profile(((storage.foldername(name))[1])::uuid) OR (("current_role"() = 'Campus Admin'::user_role) AND is_same_campus_profile(((storage.foldername(name))[1])::uuid))))) or public.is_platform_admin());

drop policy if exists exit_requests_select_storage on storage.objects;
create policy exit_requests_select_storage on storage.objects as permissive for SELECT to authenticated
  using ((((bucket_id = 'exit-requests'::text) AND (is_own_or_led_profile(((storage.foldername(name))[1])::uuid) OR is_assigned_spoc_of_profile(((storage.foldername(name))[1])::uuid) OR (("current_role"() = 'Campus Admin'::user_role) AND is_same_campus_profile(((storage.foldername(name))[1])::uuid))))) or public.is_platform_admin());

drop policy if exists exit_requests_update_storage on storage.objects;
create policy exit_requests_update_storage on storage.objects as permissive for UPDATE to authenticated
  using ((((bucket_id = 'exit-requests'::text) AND (is_led_profile(((storage.foldername(name))[1])::uuid) OR (("current_role"() = 'Campus Admin'::user_role) AND is_same_campus_profile(((storage.foldername(name))[1])::uuid))))) or public.is_platform_admin())
  with check ((((bucket_id = 'exit-requests'::text) AND (is_led_profile(((storage.foldername(name))[1])::uuid) OR (("current_role"() = 'Campus Admin'::user_role) AND is_same_campus_profile(((storage.foldername(name))[1])::uuid))))) or public.is_platform_admin());

drop policy if exists noc_uploads_delete on storage.objects;
create policy noc_uploads_delete on storage.objects as permissive for DELETE to authenticated
  using ((((bucket_id = 'noc-uploads'::text) AND (is_led_profile(((storage.foldername(name))[1])::uuid) OR is_assigned_spoc_of_profile(((storage.foldername(name))[1])::uuid) OR (("current_role"() = 'Campus Admin'::user_role) AND is_same_campus_profile(((storage.foldername(name))[1])::uuid))))) or public.is_platform_admin());

drop policy if exists noc_uploads_insert on storage.objects;
create policy noc_uploads_insert on storage.objects as permissive for INSERT to authenticated
  with check ((((bucket_id = 'noc-uploads'::text) AND (is_own_or_led_profile(((storage.foldername(name))[1])::uuid) OR (("current_role"() = 'Campus Admin'::user_role) AND is_same_campus_profile(((storage.foldername(name))[1])::uuid))))) or public.is_platform_admin());

drop policy if exists noc_uploads_select on storage.objects;
create policy noc_uploads_select on storage.objects as permissive for SELECT to authenticated
  using ((((bucket_id = 'noc-uploads'::text) AND (is_own_or_led_profile(((storage.foldername(name))[1])::uuid) OR is_assigned_spoc_of_profile(((storage.foldername(name))[1])::uuid) OR (("current_role"() = 'Campus Admin'::user_role) AND is_same_campus_profile(((storage.foldername(name))[1])::uuid))))) or public.is_platform_admin());

drop policy if exists noc_uploads_update on storage.objects;
create policy noc_uploads_update on storage.objects as permissive for UPDATE to authenticated
  using ((((bucket_id = 'noc-uploads'::text) AND (is_led_profile(((storage.foldername(name))[1])::uuid) OR is_assigned_spoc_of_profile(((storage.foldername(name))[1])::uuid) OR (("current_role"() = 'Campus Admin'::user_role) AND is_same_campus_profile(((storage.foldername(name))[1])::uuid))))) or public.is_platform_admin())
  with check ((((bucket_id = 'noc-uploads'::text) AND (is_led_profile(((storage.foldername(name))[1])::uuid) OR is_assigned_spoc_of_profile(((storage.foldername(name))[1])::uuid) OR (("current_role"() = 'Campus Admin'::user_role) AND is_same_campus_profile(((storage.foldername(name))[1])::uuid))))) or public.is_platform_admin());

drop policy if exists ppt_uploads_delete on storage.objects;
create policy ppt_uploads_delete on storage.objects as permissive for DELETE to authenticated
  using ((((bucket_id = 'ppt-uploads'::text) AND (is_led_team(((storage.foldername(name))[1])::uuid) OR (("current_role"() = 'Campus Admin'::user_role) AND is_same_campus_team(((storage.foldername(name))[1])::uuid))))) or public.is_platform_admin());

drop policy if exists ppt_uploads_insert on storage.objects;
create policy ppt_uploads_insert on storage.objects as permissive for INSERT to authenticated
  with check ((((bucket_id = 'ppt-uploads'::text) AND (is_led_team(((storage.foldername(name))[1])::uuid) OR (("current_role"() = 'Campus Admin'::user_role) AND is_same_campus_team(((storage.foldername(name))[1])::uuid))))) or public.is_platform_admin());

drop policy if exists ppt_uploads_select on storage.objects;
create policy ppt_uploads_select on storage.objects as permissive for SELECT to authenticated
  using ((((bucket_id = 'ppt-uploads'::text) AND (is_own_team(((storage.foldername(name))[1])::uuid) OR is_assigned_spoc_of_team(((storage.foldername(name))[1])::uuid) OR (("current_role"() = 'Campus Admin'::user_role) AND is_same_campus_team(((storage.foldername(name))[1])::uuid))))) or public.is_platform_admin());

drop policy if exists ppt_uploads_update on storage.objects;
create policy ppt_uploads_update on storage.objects as permissive for UPDATE to authenticated
  using ((((bucket_id = 'ppt-uploads'::text) AND (is_led_team(((storage.foldername(name))[1])::uuid) OR (("current_role"() = 'Campus Admin'::user_role) AND is_same_campus_team(((storage.foldername(name))[1])::uuid))))) or public.is_platform_admin())
  with check ((((bucket_id = 'ppt-uploads'::text) AND (is_led_team(((storage.foldername(name))[1])::uuid) OR (("current_role"() = 'Campus Admin'::user_role) AND is_same_campus_team(((storage.foldername(name))[1])::uuid))))) or public.is_platform_admin());


-- promote the global Super Admin
update public.profiles set role = 'Super Admin', campus = null
where gitam_email = 'nvinnako2@gitam.in';
