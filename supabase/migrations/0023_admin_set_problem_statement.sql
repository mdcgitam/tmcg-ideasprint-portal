-- Lets Super Admin/SPOC directly set (or correct) a team's problem
-- statement from the admin Team View — select_problem_statement (0002/0003)
-- is deliberately Team-Lead-only and window-gated, which is right for the
-- self-service flow but wrong for an admin fixing a mistake, so this is a
-- separate RPC rather than widening that one's checks. No selection-window
-- check here on purpose: an admin correction should work regardless of
-- whether the window is open.

create or replace function public.admin_set_problem_statement(p_team_id uuid, p_ps_number text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ps_id uuid;
  v_ps_title text;
  v_is_initial boolean;
begin
  if not (public.is_assigned_spoc_of_team(p_team_id) or public.current_role() = 'Super Admin') then
    raise exception 'NOT_ALLOWED';
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
$$;
revoke all on function public.admin_set_problem_statement(uuid, text) from public, anon;
grant execute on function public.admin_set_problem_statement(uuid, text) to authenticated;
