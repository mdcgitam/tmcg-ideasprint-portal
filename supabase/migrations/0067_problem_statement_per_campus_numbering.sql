-- 0067_problem_statement_per_campus_numbering.sql
-- Problem statements move from one flat 1..N range shared across all three
-- campuses to three independent per-campus tracks — matching the
-- admin-provided spreadsheet's shape (a separate tab per campus). Each
-- campus numbers its own track from 1, distinguished by a campus-letter
-- prefix (V/H/B), so "V5" and "H5" are different problem statements that
-- happen to share a number. Without this, a VSP team could type a number
-- that only ever existed in HYD's range and have it accepted, since the
-- old scheme had no notion of which campus a number belonged to.
--
-- The per-campus count ceiling is Super Admin only (problem_statement.max_
-- number.<CAMPUS>, one independent key per campus — no campus-admin
-- override, unlike the deadline configs elsewhere).

alter table public.problem_statements add column campus public.campus;

create or replace function public.upsert_problem_statement(
  p_id uuid, p_number text, p_title text, p_description text, p_status text, p_campus text default null
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_campus public.campus;
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_status not in ('Hidden', 'Released') then
    raise exception 'INVALID_STATUS';
  end if;
  if p_campus is not null then
    v_campus := p_campus::public.campus;
  end if;

  if p_id is null then
    insert into public.problem_statements (number, title, description, status, campus)
    values (p_number, p_title, p_description, p_status::public.ps_status, v_campus)
    returning id into v_id;
  else
    update public.problem_statements
       set number = p_number, title = p_title, description = p_description,
           status = p_status::public.ps_status, campus = coalesce(v_campus, campus), updated_at = now()
     where id = p_id
     returning id into v_id;
  end if;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Problem Statement Changed', 'problem_statement', v_id,
          jsonb_build_object('number', p_number, 'title', p_title, 'status', p_status, 'campus', p_campus));

  return v_id;
exception
  when unique_violation then
    raise exception 'DUPLICATE_PS_NUMBER';
end;
$function$;
revoke all on function public.upsert_problem_statement(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.upsert_problem_statement(uuid, text, text, text, text, text) to authenticated;

create or replace function public.select_problem_statement(p_team_id uuid, p_ps_number text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_ps_id uuid;
  v_ps_title text;
  v_ps_campus public.campus;
  v_team_campus public.campus;
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

  select id, title, campus into v_ps_id, v_ps_title, v_ps_campus
  from public.problem_statements where number = p_ps_number and status = 'Released';
  select campus into v_team_campus from public.teams where id = p_team_id;

  -- A problem statement belongs to one campus's track — a team may only
  -- select from its own campus, same as if the other campuses' codes
  -- didn't exist at all.
  if v_ps_id is null or v_ps_campus is distinct from v_team_campus then
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

create or replace function public.admin_set_problem_statement(p_team_id uuid, p_ps_number text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ps_id uuid;
  v_ps_title text;
  v_ps_campus public.campus;
  v_team_campus public.campus;
  v_is_initial boolean;
begin
  if not (public.is_assigned_spoc_of_team(p_team_id) or public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.is_platform_admin() and ((select campus from public.teams where id = p_team_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  select id, title, campus into v_ps_id, v_ps_title, v_ps_campus
  from public.problem_statements where number = p_ps_number and status = 'Released';
  select campus into v_team_campus from public.teams where id = p_team_id;

  if v_ps_id is null or v_ps_campus is distinct from v_team_campus then
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
