-- Phase 6 — SPOC + Super Admin dashboards, Admin Configuration. No table/RLS
-- changes needed for reads (Phase 4's profiles_select/teams_select/etc.
-- already grant SPOC visibility into assigned teams and Super Admin
-- visibility into everything) — this migration is entirely new RPCs, same
-- "no direct authenticated table grants" rule as 0001/0002.

-- ── Approval workflow ────────────────────────────────────────────────────

create or replace function public.resolve_approval_request(p_request_id uuid, p_decision text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_team_id uuid;
  v_status public.approval_status;
  v_requested_changes jsonb;
  v_requested_by uuid;
  v_member jsonb;
  v_team_name text;
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
  if not (public.is_assigned_spoc_of_team(v_team_id) or public.current_role() = 'Super Admin') then
    raise exception 'NOT_ALLOWED';
  end if;

  if p_decision = 'Approved' then
    v_team_name := v_requested_changes->'team'->>'teamName';
    if v_team_name is not null then
      update public.teams set team_name = v_team_name where id = v_team_id;
    end if;

    for v_member in select * from jsonb_array_elements(coalesce(v_requested_changes->'members', '[]'::jsonb)) loop
      update public.profiles set
        name = coalesce(v_member->>'name', name),
        phone = coalesce(v_member->>'phone', phone),
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
$$;

revoke all on function public.resolve_approval_request(uuid, text) from public, anon;
grant execute on function public.resolve_approval_request(uuid, text) to authenticated;

-- ── Attendance ───────────────────────────────────────────────────────────

create or replace function public.create_attendance_session(p_name text, p_starts_at timestamptz, p_ends_at timestamptz, p_sort_order int)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if public.current_role() <> 'Super Admin' then
    raise exception 'NOT_ALLOWED';
  end if;

  insert into public.attendance_sessions (name, starts_at, ends_at, sort_order)
  values (p_name, p_starts_at, p_ends_at, coalesce(p_sort_order, 0))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_attendance_session(text, timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.create_attendance_session(text, timestamptz, timestamptz, integer) to authenticated;

create or replace function public.record_attendance(p_session_id uuid, p_profile_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_team_id uuid;
  v_existing_id uuid;
  v_previous_status public.attendance_status;
begin
  select team_id into v_team_id from public.team_members where profile_id = p_profile_id;
  if v_team_id is null then
    raise exception 'PARTICIPANT_NOT_FOUND';
  end if;
  if not (public.is_assigned_spoc_of_team(v_team_id) or public.current_role() = 'Super Admin') then
    raise exception 'NOT_ALLOWED';
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
$$;

revoke all on function public.record_attendance(uuid, uuid, text) from public, anon;
grant execute on function public.record_attendance(uuid, uuid, text) to authenticated;

-- ── Food coupons ─────────────────────────────────────────────────────────

create or replace function public.record_food_redemption(p_profile_id uuid, p_meal text, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
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
  if not (public.is_assigned_spoc_of_team(v_team_id) or public.current_role() = 'Super Admin') then
    raise exception 'NOT_ALLOWED';
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
$$;

revoke all on function public.record_food_redemption(uuid, text, text) from public, anon;
grant execute on function public.record_food_redemption(uuid, text, text) to authenticated;

-- ── Problem Statement: deadline extension + CRUD ────────────────────────

create or replace function public.extend_problem_statement_deadline(p_team_id uuid, p_extended_until timestamptz, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not (public.is_assigned_spoc_of_team(p_team_id) or public.current_role() = 'Super Admin') then
    raise exception 'NOT_ALLOWED';
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
$$;

revoke all on function public.extend_problem_statement_deadline(uuid, timestamptz, text) from public, anon;
grant execute on function public.extend_problem_statement_deadline(uuid, timestamptz, text) to authenticated;

-- select_problem_statement (0002) now also honours a per-team extension —
-- SPEC §30-38: "if a team misses the deadline, Super Admin/SPOC can extend
-- the selection window for that specific team only." Postgres won't let
-- create-or-replace touch an existing function's return type even when the
-- new type is identical to what's already there — drop it first.
drop function if exists public.select_problem_statement(uuid, text);

create or replace function public.select_problem_statement(p_team_id uuid, p_ps_number text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_ps_id uuid;
  v_ps_title text;
  v_selection_start timestamptz;
  v_selection_end timestamptz;
  v_extended_until timestamptz;
  v_effective_end timestamptz;
  v_is_initial boolean;
begin
  if not public.is_led_team(p_team_id) then
    raise exception 'NOT_TEAM_LEAD';
  end if;

  select (value #>> '{}')::timestamptz into v_selection_start
    from public.configuration where key = 'problem_statement.selection_start';
  select (value #>> '{}')::timestamptz into v_selection_end
    from public.configuration where key = 'problem_statement.selection_end';

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

create or replace function public.upsert_problem_statement(
  p_id uuid, p_number text, p_title text, p_description text, p_status text
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if public.current_role() <> 'Super Admin' then
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
$$;

revoke all on function public.upsert_problem_statement(uuid, text, text, text, text) from public, anon;
grant execute on function public.upsert_problem_statement(uuid, text, text, text, text) to authenticated;

-- ── NOC: widen delete permission to the assigned SPOC too ───────────────
-- SPEC §39-48: "SPOC: view/manage NOCs." Return type (void) unchanged, so a
-- plain create-or-replace is fine — existing callers are unaffected.

create or replace function public.delete_noc(p_profile_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_noc_id uuid;
begin
  if not (
    public.is_led_profile(p_profile_id)
    or public.is_assigned_spoc_of_profile(p_profile_id)
    or public.current_role() = 'Super Admin'
  ) then
    raise exception 'NOT_ALLOWED';
  end if;

  update public.nocs set status = 'Not Uploaded', file_path = null, updated_at = now()
  where profile_id = p_profile_id
  returning id into v_noc_id;

  if v_noc_id is not null then
    insert into public.noc_audit_log (noc_id, action, performed_by) values (v_noc_id, 'Deleted', public.current_profile_id());
  end if;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'NOC Deleted', 'noc', p_profile_id);

  insert into public.notifications (recipient_profile_id, type, title, message)
  values (p_profile_id, 'NocDeleted', 'NOC deleted', 'Your NOC was deleted — you can re-upload it.');
end;
$$;

revoke all on function public.delete_noc(uuid) from public, anon;
grant execute on function public.delete_noc(uuid) to authenticated;

-- ── SPOC assignment + roles ──────────────────────────────────────────────

-- p_spoc_profile_id may be null to unassign (used by the per-SPOC
-- checklist UI, which diffs checked/unchecked teams against the current
-- assignment and calls this once per changed team).
create or replace function public.assign_spoc(p_team_id uuid, p_spoc_profile_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if public.current_role() <> 'Super Admin' then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_spoc_profile_id is not null and not exists (select 1 from public.profiles where id = p_spoc_profile_id and role = 'SPOC') then
    raise exception 'NOT_A_SPOC';
  end if;

  update public.teams set spoc_profile_id = p_spoc_profile_id, updated_at = now() where id = p_team_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'SPOC Assignment Changed', 'team', p_team_id, jsonb_build_object('spoc_profile_id', p_spoc_profile_id));
end;
$$;

revoke all on function public.assign_spoc(uuid, uuid) from public, anon;
grant execute on function public.assign_spoc(uuid, uuid) to authenticated;

create or replace function public.update_user_role(p_profile_id uuid, p_new_role text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_previous_role public.user_role;
begin
  if public.current_role() <> 'Super Admin' then
    raise exception 'NOT_ALLOWED';
  end if;

  select role into v_previous_role from public.profiles where id = p_profile_id;

  update public.profiles set role = p_new_role::public.user_role, updated_at = now() where id = p_profile_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, previous_value, new_value)
  values (public.current_profile_id(), 'User Role Changed', 'profile', p_profile_id,
          jsonb_build_object('role', v_previous_role), jsonb_build_object('role', p_new_role));
end;
$$;

revoke all on function public.update_user_role(uuid, text) from public, anon;
grant execute on function public.update_user_role(uuid, text) to authenticated;

-- ── Admin Configuration ──────────────────────────────────────────────────

create or replace function public.set_configuration(p_key text, p_value jsonb, p_description text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if public.current_role() <> 'Super Admin' then
    raise exception 'NOT_ALLOWED';
  end if;

  insert into public.configuration (key, value, description, updated_by, updated_at)
  values (p_key, p_value, p_description, public.current_profile_id(), now())
  on conflict (key) do update
    set value = excluded.value,
        description = coalesce(excluded.description, public.configuration.description),
        updated_by = excluded.updated_by, updated_at = now();
end;
$$;

revoke all on function public.set_configuration(text, jsonb, text) from public, anon;
grant execute on function public.set_configuration(text, jsonb, text) to authenticated;
