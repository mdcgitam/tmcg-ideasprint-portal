-- 0071_problem_statement_hide.sql
-- Super Admin can now pause (hide) problem statement selection per campus
-- (or all three via "All") without touching the already-created catalog
-- or existing team selections — reversible instantly, unlike deleting/
-- recreating problem statements. Kept as a distinct config key rather than
-- reusing problem_statement.live_at, since live_at also serves as the
-- historical "when did this first go live" record; toggling that on/off
-- would stamp a new timestamp every time and lose the original one.
--
-- A campus-specific override always wins over the global value, same rule
-- as the spreadsheet URL/live_at (not latest-edit-wins) — set from "All",
-- it pauses everyone; set from one campus's module, it pauses just that
-- campus. Hiding blocks new selections outright (not just the spreadsheet
-- link) — applies to everyone, admins included, since the whole point is
-- "stop this from being used right now"; a Super Admin who needs to
-- override just un-hides first.

create or replace function public.problem_statement_hidden_for_campus(p_campus public.campus)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_campus_value jsonb;
  v_global_value jsonb;
begin
  if p_campus is not null then
    select value into v_campus_value from public.configuration where key = 'problem_statement.hidden.' || p_campus;
    if v_campus_value is not null then
      return (v_campus_value #>> '{}')::boolean;
    end if;
  end if;

  select value into v_global_value from public.configuration where key = 'problem_statement.hidden';
  if v_global_value is not null then
    return (v_global_value #>> '{}')::boolean;
  end if;

  return false;
end;
$$;
revoke all on function public.problem_statement_hidden_for_campus(public.campus) from public, anon, authenticated;

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

  select campus into v_team_campus from public.teams where id = p_team_id;
  if public.problem_statement_hidden_for_campus(v_team_campus) then
    raise exception 'SELECTION_PAUSED';
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

  select campus into v_team_campus from public.teams where id = p_team_id;
  if public.problem_statement_hidden_for_campus(v_team_campus) then
    raise exception 'SELECTION_PAUSED';
  end if;

  select id, title, campus into v_ps_id, v_ps_title, v_ps_campus
  from public.problem_statements where number = p_ps_number and status = 'Released';

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
