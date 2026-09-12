-- 0066_ppt_ps_deadline_latest_edit_wins.sql
-- Extends the "latest edit wins" three-way deadline resolution built for
-- NOC (0064/0065) to PPT and Problem Statement, per explicit request: the
-- same rule — whichever of {global general config, campus-scoped general
-- config, individual/per-team override} was edited most recently is the
-- one actually in force — should govern all three modules identically.
--
-- PPT: record_presentation had also regressed in 0062 — it dropped the
-- campus-scoped ppt.general_deadline.<campus> comparison entirely and fell
-- back to only the global default, silently ignoring a Campus Admin's
-- override. Centralizing the resolution in effective_presentation_deadline
-- (mirroring effective_noc_deadline) fixes that too.
--
-- Problem Statement: the per-team extension (problem_statement_extensions)
-- previously used "greatest(selection_end, extended_until)" — an extension
-- could only push the deadline later, and once set it could never be
-- superseded by a later, more permissive edit to the general window later
-- than the general edit or earlier than the extension. Switching to
-- latest-edit-wins (using the extension's existing granted_at as its
-- timestamp) makes it behave exactly like NOC's individual override.

alter table public.presentations add column deadline_updated_at timestamptz;
-- No prior updated_at existed on presentations to approximate from — treat
-- any already-set per-team deadline as "just edited" so it keeps winning
-- until the next edit on either side actually changes something.
update public.presentations set deadline_updated_at = now() where deadline is not null;

create or replace function public.effective_presentation_deadline(p_team_id uuid)
returns timestamptz language plpgsql stable security definer set search_path = public as $$
declare
  v_campus text;
  v_individual_deadline timestamptz;
  v_individual_updated timestamptz;
  v_global_value timestamptz;
  v_global_updated timestamptz;
  v_campus_value timestamptz;
  v_campus_updated timestamptz;
  v_general_deadline timestamptz;
  v_general_updated timestamptz;
begin
  select campus::text into v_campus from public.teams where id = p_team_id;

  select deadline, deadline_updated_at into v_individual_deadline, v_individual_updated
  from public.presentations where team_id = p_team_id;

  select (value #>> '{}')::timestamptz, updated_at into v_global_value, v_global_updated
  from public.configuration where key = 'ppt.general_deadline';

  if v_campus is not null then
    select (value #>> '{}')::timestamptz, updated_at into v_campus_value, v_campus_updated
    from public.configuration where key = 'ppt.general_deadline.' || v_campus;
  end if;

  if v_campus_value is not null and (v_global_value is null or v_campus_updated >= v_global_updated) then
    v_general_deadline := v_campus_value;
    v_general_updated := v_campus_updated;
  else
    v_general_deadline := v_global_value;
    v_general_updated := v_global_updated;
  end if;

  if v_individual_deadline is not null and (v_general_deadline is null or v_individual_updated >= v_general_updated) then
    return v_individual_deadline;
  end if;
  return v_general_deadline;
end;
$$;
revoke all on function public.effective_presentation_deadline(uuid) from public, anon, authenticated;

create or replace function public.extend_presentation_deadline(p_team_id uuid, p_deadline timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_assigned_spoc_of_team(p_team_id) or public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.is_platform_admin() and ((select campus from public.teams where id = p_team_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  insert into public.presentations (team_id, deadline, deadline_updated_at) values (p_team_id, p_deadline, now())
  on conflict (team_id) do update set deadline = excluded.deadline, deadline_updated_at = now();

  insert into public.notifications (recipient_profile_id, type, title, message)
  select tm.profile_id, 'PresentationDeadlineExtended', 'Presentation deadline extended',
         'Your team''s presentation submission deadline has been extended.'
  from public.team_members tm
  where tm.team_id = p_team_id and tm.is_lead = true;
end;
$$;
revoke all on function public.extend_presentation_deadline(uuid, timestamptz) from public, anon;
grant execute on function public.extend_presentation_deadline(uuid, timestamptz) to authenticated;

create or replace function public.record_presentation(p_team_id uuid, p_file_path text)
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
    or public.is_assigned_spoc_of_team(p_team_id)
  ) then
    raise exception 'NOT_TEAM_LEAD';
  end if;
  if not exists (select 1 from public.teams where id = p_team_id) then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  v_deadline := public.effective_presentation_deadline(p_team_id);
  if v_deadline is null and not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'DEADLINE_NOT_SET';
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

create or replace function public.effective_problem_statement_start(p_team_id uuid)
returns timestamptz language plpgsql stable security definer set search_path = public as $$
declare
  v_campus text;
  v_global_value timestamptz;
  v_global_updated timestamptz;
  v_campus_value timestamptz;
  v_campus_updated timestamptz;
begin
  select campus::text into v_campus from public.teams where id = p_team_id;

  select (value #>> '{}')::timestamptz, updated_at into v_global_value, v_global_updated
  from public.configuration where key = 'problem_statement.selection_start';

  if v_campus is not null then
    select (value #>> '{}')::timestamptz, updated_at into v_campus_value, v_campus_updated
    from public.configuration where key = 'problem_statement.selection_start.' || v_campus;
  end if;

  if v_campus_value is not null and (v_global_value is null or v_campus_updated >= v_global_updated) then
    return v_campus_value;
  end if;
  return v_global_value;
end;
$$;
revoke all on function public.effective_problem_statement_start(uuid) from public, anon, authenticated;

create or replace function public.effective_problem_statement_end(p_team_id uuid)
returns timestamptz language plpgsql stable security definer set search_path = public as $$
declare
  v_campus text;
  v_extended_until timestamptz;
  v_extended_updated timestamptz;
  v_global_value timestamptz;
  v_global_updated timestamptz;
  v_campus_value timestamptz;
  v_campus_updated timestamptz;
  v_general_end timestamptz;
  v_general_updated timestamptz;
begin
  select campus::text into v_campus from public.teams where id = p_team_id;

  select extended_until, granted_at into v_extended_until, v_extended_updated
  from public.problem_statement_extensions where team_id = p_team_id;

  select (value #>> '{}')::timestamptz, updated_at into v_global_value, v_global_updated
  from public.configuration where key = 'problem_statement.selection_end';

  if v_campus is not null then
    select (value #>> '{}')::timestamptz, updated_at into v_campus_value, v_campus_updated
    from public.configuration where key = 'problem_statement.selection_end.' || v_campus;
  end if;

  if v_campus_value is not null and (v_global_value is null or v_campus_updated >= v_global_updated) then
    v_general_end := v_campus_value;
    v_general_updated := v_campus_updated;
  else
    v_general_end := v_global_value;
    v_general_updated := v_global_updated;
  end if;

  if v_extended_until is not null and (v_general_end is null or v_extended_updated >= v_general_updated) then
    return v_extended_until;
  end if;
  return v_general_end;
end;
$$;
revoke all on function public.effective_problem_statement_end(uuid) from public, anon, authenticated;

create or replace function public.select_problem_statement(p_team_id uuid, p_ps_number text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_ps_id uuid;
  v_ps_title text;
  v_selection_start timestamptz;
  v_effective_end timestamptz;
  v_is_initial boolean;
begin
  if not public.is_led_team(p_team_id) then
    raise exception 'NOT_TEAM_LEAD';
  end if;

  v_selection_start := public.effective_problem_statement_start(p_team_id);
  v_effective_end := public.effective_problem_statement_end(p_team_id);

  if v_selection_start is null or v_effective_end is null then
    raise exception 'SELECTION_NOT_CONFIGURED';
  end if;

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
