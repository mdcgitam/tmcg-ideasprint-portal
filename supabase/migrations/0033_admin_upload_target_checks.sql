-- 0033_admin_upload_target_checks.sql
-- Admin NOC/PPT upload sync: fail with a clear PARTICIPANT_NOT_FOUND /
-- TEAM_NOT_FOUND (not a raw FK violation) when the target was deleted while
-- the admin's tab was still showing it. The client rolls back the just-
-- uploaded storage file on any such failure, and router.refresh()es on
-- success, so storage and the DB can't drift.

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
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'PARTICIPANT_NOT_FOUND';
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
  if not exists (select 1 from public.teams where id = p_team_id) then
    raise exception 'TEAM_NOT_FOUND';
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
