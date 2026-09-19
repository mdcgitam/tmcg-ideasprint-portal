-- 0080_campus_registration_caps.sql
--
-- Per-campus team registration caps (one slot = one team): Visakhapatnam
-- 100, Hyderabad 70, Bangalore 50. Stored in `configuration`, not
-- hardcoded — same pattern as problem_statement.max_number.<CAMPUS>
-- (0067) — so a Super Admin/Campus Admin can adjust a cap later via
-- set_configuration without a migration. register_team enforces the cap
-- server-side, which is the actual stop: independent of anything the
-- registration form does or doesn't check client-side.

insert into public.configuration (key, value, description)
values
  ('registration.team_cap.VSP', '100'::jsonb, 'Maximum registered teams for Visakhapatnam — one slot per team.'),
  ('registration.team_cap.HYD', '70'::jsonb, 'Maximum registered teams for Hyderabad — one slot per team.'),
  ('registration.team_cap.BLR', '50'::jsonb, 'Maximum registered teams for Bangalore — one slot per team.')
on conflict (key) do nothing;

-- Public, read-only per-campus team counts + configured caps for the
-- homepage/registration form's slot displays — same anon-safe SECURITY
-- DEFINER pattern as get_confirmed_team_count (0010), just broken out per
-- campus and paired with each campus's cap so the client never has to
-- reconcile two separate calls (or hardcode the cap itself).
create or replace function public.get_team_counts_by_campus()
returns table (campus text, registered integer, cap integer)
language sql stable security definer set search_path = public as $$
  select
    c::text,
    count(t.id)::integer as registered,
    coalesce((cfg.value #>> '{}')::integer, 2147483647) as cap
  from unnest(enum_range(null::public.campus)) as c
  left join public.teams t on t.campus = c
  left join public.configuration cfg on cfg.key = 'registration.team_cap.' || c::text
  group by c, cfg.value;
$$;
revoke all on function public.get_team_counts_by_campus() from public;
grant execute on function public.get_team_counts_by_campus() to anon, authenticated;

-- register_team (source: 0026) — adds the per-campus cap check right after
-- the existing campus-validity check. A missing/unparseable cap config
-- falls back to effectively unlimited (2147483647) so an unset config row
-- never accidentally blocks every registration for that campus.
create or replace function public.register_team(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_team_name text := p_payload->'team'->>'teamName';
  v_member_count int := (p_payload->'team'->>'memberCount')::int;
  v_campus text := p_payload->'team'->>'campus';
  v_members jsonb := p_payload->'members';
  v_team_id uuid;
  v_team_code text;
  v_member jsonb;
  v_pos bigint;
  v_idx int := 0;
  v_profile_id uuid;
  v_user_id text;
  v_user_ids text[] := '{}';
  v_lead_profile_id uuid;
  v_cap integer;
  v_registered integer;
begin
  if v_campus is null or v_campus not in ('VSP', 'BLR', 'HYD') then
    raise exception 'INVALID_CAMPUS';
  end if;

  select (value #>> '{}')::integer into v_cap
  from public.configuration where key = 'registration.team_cap.' || v_campus;
  v_cap := coalesce(v_cap, 2147483647);

  select count(*) into v_registered from public.teams where campus = v_campus::public.campus;
  if v_registered >= v_cap then
    raise exception 'CAMPUS_FULL:%', v_campus;
  end if;

  if exists (select 1 from public.teams where team_name = v_team_name) then
    raise exception 'DUPLICATE_TEAM_NAME';
  end if;

  for v_member in select * from jsonb_array_elements(v_members) loop
    if exists (select 1 from public.profiles where gitam_email = lower(v_member->>'gitamEmail')) then
      raise exception 'DUPLICATE_EMAIL:%', v_member->>'gitamEmail';
    end if;
    if exists (select 1 from public.profiles where reg_no = v_member->>'regNo') then
      raise exception 'DUPLICATE_REGNO:%', v_member->>'regNo';
    end if;
    if exists (select 1 from public.profiles where phone = v_member->>'phone') then
      raise exception 'DUPLICATE_PHONE:%', v_member->>'phone';
    end if;
  end loop;

  for v_member, v_pos in
    select value, ordinality from jsonb_array_elements(v_members) with ordinality
  loop
    perform public.validate_member_academics(
      'Member ' || v_pos || coalesce(' (' || nullif(btrim(v_member->>'name'), '') || ')', ''),
      v_member->>'name', v_member->>'regNo', v_member->>'gitamEmail', v_member->>'phone',
      v_member->>'graduation', v_member->>'program', v_member->>'yearOfStudy',
      v_member->>'school', v_member->>'department', v_member->>'branch',
      v_member->>'gender', v_member->>'stay', true
    );
  end loop;

  v_team_code := public.next_team_id();

  insert into public.teams (team_id, team_name, member_count, status, campus)
  values (v_team_code, v_team_name, v_member_count, 'Registered', v_campus::public.campus)
  returning id into v_team_id;

  for v_member in select * from jsonb_array_elements(v_members) loop
    v_user_id := public.next_user_id(v_campus);

    insert into public.profiles (
      user_id, campus, role, name, gitam_email, phone, reg_no,
      graduation, program, year_of_study, school, department, branch, gender, stay
    ) values (
      v_user_id, v_campus::public.campus,
      case when v_idx = 0 then 'Team Lead' else 'Member' end::public.user_role,
      v_member->>'name', lower(v_member->>'gitamEmail'), v_member->>'phone', v_member->>'regNo',
      v_member->>'graduation', v_member->>'program',
      v_member->>'yearOfStudy', v_member->>'school', v_member->>'department',
      v_member->>'branch', v_member->>'gender', v_member->>'stay'
    ) returning id into v_profile_id;

    insert into public.team_members (team_id, profile_id, is_lead)
    values (v_team_id, v_profile_id, v_idx = 0);

    if v_idx = 0 then v_lead_profile_id := v_profile_id; end if;

    v_user_ids := array_append(v_user_ids, v_user_id);
    v_idx := v_idx + 1;
  end loop;

  update public.teams set team_lead_profile_id = v_lead_profile_id where id = v_team_id;

  return jsonb_build_object('team_id', v_team_code, 'user_ids', v_user_ids);

exception
  when unique_violation then
    raise exception 'DUPLICATE_ENTRY: %', sqlerrm;
end;
$$;

revoke all on function public.register_team(jsonb) from public, anon, authenticated;
grant execute on function public.register_team(jsonb) to service_role;
