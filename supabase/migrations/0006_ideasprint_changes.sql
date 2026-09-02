-- Phase 7 — IdeaSprint 4.0 change requests (ideasprint_changes.pdf):
-- rooms/zones + room-based SPOC assignment, domain removal, delete RPCs,
-- privacy policy config. Same conventions as 0001-0005: no direct
-- INSERT/UPDATE/DELETE grants to `authenticated`, every mutation goes
-- through a SECURITY DEFINER RPC.

-- ── Rooms & Zones ────────────────────────────────────────────────────────
-- A room is what teams are physically assigned to; a SPOC is assigned to a
-- room only (never directly to a team/person) and that assignment cascades
-- to every team currently in the room. Zones group rooms under a manager.

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  zone_manager_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  zone_id uuid references public.zones(id) on delete set null,
  spoc_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rooms_zone_id_idx on public.rooms (zone_id);

alter table public.teams add column room_id uuid references public.rooms(id) on delete set null;
create index teams_room_id_idx on public.teams (room_id);

-- Denormalized cascade: teams.spoc_profile_id always mirrors its room's
-- spoc_profile_id once the team is assigned to a room, so every existing RLS
-- policy / RPC keyed on teams.spoc_profile_id (is_assigned_spoc_of_team,
-- attendance/food/noc policies, etc. from 0001-0003) keeps working
-- unmodified under the new "SPOC is assigned to a room only" rule.
create or replace function public.cascade_room_spoc_to_teams()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.teams set spoc_profile_id = new.spoc_profile_id, updated_at = now() where room_id = new.id;
  return new;
end;
$$;

create trigger rooms_spoc_cascade
after update of spoc_profile_id on public.rooms
for each row execute function public.cascade_room_spoc_to_teams();

alter table public.zones enable row level security;
alter table public.rooms enable row level security;

-- Room/zone names aren't sensitive and every dashboard needs to resolve
-- them (a team needs to see its own room, admins need the full list) —
-- broader read access than the per-team policies elsewhere, deliberately.
create policy zones_select on public.zones for select to authenticated using (true);
create policy rooms_select on public.rooms for select to authenticated using (true);

-- ── Filter-support indexes (item 10: year / spoc-room / gender / PS / zone / team size) ──
create index if not exists profiles_gender_idx on public.profiles (gender);
create index if not exists profiles_year_of_study_idx on public.profiles (year_of_study);
create index if not exists teams_member_count_idx on public.teams (member_count);
create index if not exists teams_current_ps_idx on public.teams (current_problem_statement_id);

-- ── Room / Zone RPCs (Super Admin only) ────────────────────────────────────

create or replace function public.create_room(p_name text, p_zone_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;

  insert into public.rooms (name, zone_id) values (p_name, p_zone_id) returning id into v_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Room Created', 'room', v_id, jsonb_build_object('name', p_name));

  return v_id;
exception
  when unique_violation then raise exception 'DUPLICATE_ROOM_NAME';
end;
$$;
revoke all on function public.create_room(text, uuid) from public, anon;
grant execute on function public.create_room(text, uuid) to authenticated;

create or replace function public.create_zone(p_name text, p_manager_profile_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;

  insert into public.zones (name, zone_manager_profile_id) values (p_name, p_manager_profile_id) returning id into v_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Zone Created', 'zone', v_id, jsonb_build_object('name', p_name));

  return v_id;
exception
  when unique_violation then raise exception 'DUPLICATE_ZONE_NAME';
end;
$$;
revoke all on function public.create_zone(text, uuid) from public, anon;
grant execute on function public.create_zone(text, uuid) to authenticated;

-- p_manager_profile_id may be null to unassign.
create or replace function public.assign_zone_manager(p_zone_id uuid, p_manager_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;

  update public.zones set zone_manager_profile_id = p_manager_profile_id, updated_at = now() where id = p_zone_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Zone Manager Assigned', 'zone', p_zone_id, jsonb_build_object('manager_profile_id', p_manager_profile_id));
end;
$$;
revoke all on function public.assign_zone_manager(uuid, uuid) from public, anon;
grant execute on function public.assign_zone_manager(uuid, uuid) to authenticated;

-- p_zone_id may be null to pull a room out of its zone.
create or replace function public.assign_room_to_zone(p_room_id uuid, p_zone_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
  update public.rooms set zone_id = p_zone_id, updated_at = now() where id = p_room_id;
end;
$$;
revoke all on function public.assign_room_to_zone(uuid, uuid) from public, anon;
grant execute on function public.assign_room_to_zone(uuid, uuid) to authenticated;

-- p_spoc_profile_id may be null to unassign the room's SPOC. Reassignable
-- any time, per the spec ("he can change it whenever he wants") — the
-- rooms_spoc_cascade trigger propagates the change to every team in the room.
create or replace function public.assign_spoc_to_room(p_room_id uuid, p_spoc_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
  if p_spoc_profile_id is not null and not exists (select 1 from public.profiles where id = p_spoc_profile_id and role = 'SPOC') then
    raise exception 'NOT_A_SPOC';
  end if;

  update public.rooms set spoc_profile_id = p_spoc_profile_id, updated_at = now() where id = p_room_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Room SPOC Assigned', 'room', p_room_id, jsonb_build_object('spoc_profile_id', p_spoc_profile_id));
end;
$$;
revoke all on function public.assign_spoc_to_room(uuid, uuid) from public, anon;
grant execute on function public.assign_spoc_to_room(uuid, uuid) to authenticated;

-- Adds a team to a room and immediately inherits that room's current SPOC —
-- "SPOC ... automatically assigned to all the teams/people in that room."
-- p_room_id may be null to pull a team out of its room (clears its SPOC too).
create or replace function public.assign_team_to_room(p_team_id uuid, p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_spoc uuid;
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;

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
$$;
revoke all on function public.assign_team_to_room(uuid, uuid) from public, anon;
grant execute on function public.assign_team_to_room(uuid, uuid) to authenticated;

-- ── Delete RPCs (item 11: "Delete teams, members and SPOCs") ──────────────

create or replace function public.delete_team(p_team_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_profile_id uuid;
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
  if not exists (select 1 from public.teams where id = p_team_id) then raise exception 'TEAM_NOT_FOUND'; end if;

  -- Clear the FK first — team_lead_profile_id has no ON DELETE clause, so
  -- deleting the lead's profile below would otherwise violate it.
  update public.teams set team_lead_profile_id = null where id = p_team_id;

  for v_profile_id in select profile_id from public.team_members where team_id = p_team_id loop
    delete from public.attendance where profile_id = v_profile_id;
    delete from public.food_coupons where profile_id = v_profile_id;
    delete from public.nocs where profile_id = v_profile_id;
  end loop;

  -- exit_forms.team_id has no ON DELETE clause either.
  delete from public.exit_forms where team_id = p_team_id;

  -- Cascades team_members (profile_id ON DELETE CASCADE).
  delete from public.profiles where id in (select profile_id from public.team_members where team_id = p_team_id);

  -- Cascades any remaining team_members, approval_requests,
  -- problem_statement_selections/extensions (all ON DELETE CASCADE on teams).
  delete from public.teams where id = p_team_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'Team Deleted', 'team', p_team_id);
end;
$$;
revoke all on function public.delete_team(uuid) from public, anon;
grant execute on function public.delete_team(uuid) to authenticated;

-- Single-participant deletion — use delete_team to remove a Team Lead
-- (deleting the whole team), never this, so a team is never left leaderless.
create or replace function public.delete_member(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
  if exists (select 1 from public.team_members where profile_id = p_profile_id and is_lead) then
    raise exception 'CANNOT_DELETE_LEAD';
  end if;

  delete from public.attendance where profile_id = p_profile_id;
  delete from public.food_coupons where profile_id = p_profile_id;
  delete from public.nocs where profile_id = p_profile_id;
  -- Cascades team_members (profile_id ON DELETE CASCADE).
  delete from public.profiles where id = p_profile_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'Member Deleted', 'profile', p_profile_id);
end;
$$;
revoke all on function public.delete_member(uuid) from public, anon;
grant execute on function public.delete_member(uuid) to authenticated;

create or replace function public.delete_spoc(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
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
$$;
revoke all on function public.delete_spoc(uuid) from public, anon;
grant execute on function public.delete_spoc(uuid) to authenticated;

-- ── Domains removed as a concept (item 1) ──────────────────────────────────
-- Home page, filters, and registration no longer reference a domain.

alter table public.teams drop column if exists domain_id;

drop function if exists public.register_team(jsonb);
create or replace function public.register_team(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_name text := p_payload->'team'->>'teamName';
  v_member_count int := (p_payload->'team'->>'memberCount')::int;
  v_members jsonb := p_payload->'members';
  v_team_id uuid;
  v_team_code text;
  v_member jsonb;
  v_idx int := 0;
  v_profile_id uuid;
  v_user_id text;
  v_user_ids text[] := '{}';
  v_lead_profile_id uuid;
begin
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

  v_team_code := public.next_team_id();

  insert into public.teams (team_id, team_name, member_count, status)
  values (v_team_code, v_team_name, v_member_count, 'Registered')
  returning id into v_team_id;

  for v_member in select * from jsonb_array_elements(v_members) loop
    v_user_id := public.next_user_id('VSP');

    insert into public.profiles (
      user_id, campus, role, name, gitam_email, phone, reg_no,
      year_of_study, school, department, branch, gender, stay
    ) values (
      v_user_id, 'VSP',
      case when v_idx = 0 then 'Team Lead' else 'Member' end::public.user_role,
      v_member->>'name', lower(v_member->>'gitamEmail'), v_member->>'phone', v_member->>'regNo',
      v_member->>'yearOfStudy', v_member->>'school', v_member->>'department',
      v_member->>'branch', v_member->>'gender', v_member->>'stay'
    ) returning id into v_profile_id;

    insert into public.team_members (team_id, profile_id, is_lead)
    values (v_team_id, v_profile_id, v_idx = 0);

    if v_idx = 0 then
      v_lead_profile_id := v_profile_id;
    end if;

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

-- ── Privacy Policy (item 23: Super Admin edits directly from the dashboard) ──
-- null value = the /privacy page falls back to its built-in default copy.
insert into public.configuration (key, value, description)
values ('privacy_policy.content', 'null'::jsonb, 'Rich text (plain paragraphs, blank line = new paragraph) for the public /privacy page. Null uses the built-in default copy.')
on conflict (key) do nothing;
