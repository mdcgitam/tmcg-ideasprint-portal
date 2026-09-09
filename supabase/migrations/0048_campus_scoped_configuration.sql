-- 0048_campus_scoped_configuration.sql
-- Campus Admin can now set a campus-scoped override for the Problem
-- Statement selection window and the General NOC/PPT deadlines, stored
-- under the same generic `configuration` key with a campus suffix (e.g.
-- `noc.general_deadline.VSP`) alongside the Super-Admin-set global default
-- (`noc.general_deadline`). This migration adds that override as a middle
-- fallback tier — between the existing individual override and the global
-- default — to the three RPCs that actually enforce these deadlines/window.
-- The Configuration UI writes the campus-suffixed key; nothing here changes
-- how or where values are written, only how they're read back.

-- ── record_noc_metadata: individual -> campus general -> global general ──
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
  v_campus text;
begin
  if not (
    public.is_own_or_led_profile(p_profile_id)
    or public.current_role() = 'Campus Admin' or public.is_platform_admin()
    or public.is_assigned_spoc_of_profile(p_profile_id)
  ) then
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
    select campus::text into v_campus from public.profiles where id = p_profile_id;
    if v_campus is not null then
      select (value #>> '{}')::timestamptz into v_deadline
      from public.configuration where key = 'noc.general_deadline.' || v_campus;
    end if;
  end if;
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

-- ── record_presentation: individual -> campus general -> global general ──
CREATE OR REPLACE FUNCTION public.record_presentation(p_team_id uuid, p_file_path text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_deadline timestamptz;
  v_campus text;
begin
  if not (
    public.is_led_team(p_team_id)
    or (public.current_role() = 'Campus Admin' and public.is_same_campus_team(p_team_id)) or public.is_platform_admin()
    or public.is_assigned_spoc_of_team(p_team_id)
  ) then
    raise exception 'NOT_TEAM_LEAD';
  end if;
  if not exists (select 1 from public.teams where id = p_team_id) then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  select deadline into v_deadline from public.presentations where team_id = p_team_id;
  if v_deadline is null then
    select campus::text into v_campus from public.teams where id = p_team_id;
    if v_campus is not null then
      select (value #>> '{}')::timestamptz into v_deadline
      from public.configuration where key = 'ppt.general_deadline.' || v_campus;
    end if;
  end if;
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

-- ── select_problem_statement: per-team-campus selection window, falling back to global ──
create or replace function public.select_problem_statement(p_team_id uuid, p_ps_number text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_ps_id uuid;
  v_ps_title text;
  v_campus text;
  v_selection_start timestamptz;
  v_selection_end timestamptz;
  v_extended_until timestamptz;
  v_effective_end timestamptz;
  v_is_initial boolean;
begin
  if not public.is_led_team(p_team_id) then
    raise exception 'NOT_TEAM_LEAD';
  end if;

  select campus::text into v_campus from public.teams where id = p_team_id;

  if v_campus is not null then
    select (value #>> '{}')::timestamptz into v_selection_start
      from public.configuration where key = 'problem_statement.selection_start.' || v_campus;
    select (value #>> '{}')::timestamptz into v_selection_end
      from public.configuration where key = 'problem_statement.selection_end.' || v_campus;
  end if;

  if v_selection_start is null then
    select (value #>> '{}')::timestamptz into v_selection_start
      from public.configuration where key = 'problem_statement.selection_start';
  end if;
  if v_selection_end is null then
    select (value #>> '{}')::timestamptz into v_selection_end
      from public.configuration where key = 'problem_statement.selection_end';
  end if;

  if v_selection_start is null or v_selection_end is null then
    raise exception 'SELECTION_NOT_CONFIGURED';
  end if;

  select extended_until into v_extended_until
    from public.problem_statement_extensions where team_id = p_team_id;

  v_effective_end := greatest(v_selection_end, coalesce(v_extended_until, v_selection_end));

  if now() < v_selection_start or now() > v_effective_end then
    raise exception 'SELECTION_CLOSED';
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
  values (public.current_profile_id(), 'Problem Statement Selected', 'team', p_team_id, jsonb_build_object('ps_number', p_ps_number));

  insert into public.notifications (recipient_profile_id, type, title, message)
  select team_lead_profile_id, 'ProblemStatementChanged', 'Problem statement updated',
         'Your team selected problem statement ' || p_ps_number
  from public.teams where id = p_team_id;

  return jsonb_build_object('id', v_ps_id, 'number', p_ps_number, 'title', v_ps_title);
end;
$$;
revoke all on function public.select_problem_statement(uuid, text) from public, anon;
grant execute on function public.select_problem_statement(uuid, text) to authenticated;
