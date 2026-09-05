-- 0025_campus_isolation.sql — three-campus (VSP/BLR/HYD) data isolation.
-- Conventions match 0001-0024: no direct INSERT/UPDATE/DELETE grants to
-- `authenticated`; every mutation goes through a SECURITY DEFINER RPC; RLS
-- helpers are SECURITY DEFINER with a fixed search_path so they don't recurse
-- when called from a policy.

-- ── Enum ────────────────────────────────────────────────────────────────
create type public.campus as enum ('VSP', 'BLR', 'HYD');

-- ── Columns ─────────────────────────────────────────────────────────────
-- profiles.campus already exists as text default 'VSP'; every row is 'VSP'.
alter table public.profiles
  alter column campus drop default,
  alter column campus type public.campus using campus::public.campus,
  alter column campus set default 'VSP',
  alter column campus set not null;

alter table public.teams  add column campus public.campus not null default 'VSP';
alter table public.rooms  add column campus public.campus not null default 'VSP';
alter table public.zones  add column campus public.campus not null default 'VSP';

create index if not exists teams_campus_idx   on public.teams (campus);
create index if not exists profiles_campus_idx on public.profiles (campus);
create index if not exists rooms_campus_idx   on public.rooms (campus);
create index if not exists zones_campus_idx   on public.zones (campus);

-- ── User ID counters ────────────────────────────────────────────────────
-- Reset VSP to 1000 ONLY if no VSP User IDs have been issued yet (Spec D6).
update public.campus_counters
   set next_user_seq = 1000
 where campus_code = 'VSP'
   and not exists (
     select 1 from public.profiles
     where campus = 'VSP' and user_id ~ '^VSP[0-9]+$'
   );

insert into public.campus_counters (campus_code, next_user_seq)
values ('BLR', 1000), ('HYD', 1000)
on conflict (campus_code) do nothing;

-- ── Campus RLS helpers ──────────────────────────────────────────────────
create or replace function public.current_campus()
returns public.campus
language sql stable security definer set search_path = public as $$
  select campus from public.profiles where auth_user_id = auth.uid();
$$;

-- For the storage.objects policies, which key off a path segment and can't JOIN.
create or replace function public.is_same_campus_team(p_team_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.teams
    where id = p_team_id and campus = public.current_campus()
  );
$$;

create or replace function public.is_same_campus_profile(p_profile_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = p_profile_id and campus = public.current_campus()
  );
$$;

-- ── Table SELECT policies: scope the Super-Admin branch to current_campus() ──
-- Each policy body below is copied verbatim from its source migration; the ONLY
-- change is ANDing the campus predicate into the bare
-- `public.current_role() = 'Super Admin'` clause. Every other branch (self /
-- teammate / assigned-SPOC / Team Lead) is byte-for-byte unchanged. Recreated
-- with drop+create so the migration is re-runnable.

-- profiles.profiles_select (source 0001)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (
  auth_user_id = auth.uid()
  or id in (select profile_id from public.team_members where team_id = public.current_team_id())
  or id in (
    select tm.profile_id from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where t.spoc_profile_id = public.current_profile_id()
  )
  or (public.current_role() = 'Super Admin' and profiles.campus = public.current_campus())
);

-- teams.teams_select (source 0001)
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams for select to authenticated
using (
  id = public.current_team_id()
  or spoc_profile_id = public.current_profile_id()
  or (public.current_role() = 'Super Admin' and campus = public.current_campus())
);

-- team_members.team_members_select (source 0001)
drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members for select to authenticated
using (
  team_id = public.current_team_id()
  or team_id in (select id from public.teams where spoc_profile_id = public.current_profile_id())
  or (public.current_role() = 'Super Admin' and (select t.campus from public.teams t where t.id = team_members.team_id) = public.current_campus())
);

-- problem_statement_selections.ps_selections_select (source 0001)
drop policy if exists ps_selections_select on public.problem_statement_selections;
create policy ps_selections_select on public.problem_statement_selections for select to authenticated
using (
  team_id = public.current_team_id()
  or team_id in (select id from public.teams where spoc_profile_id = public.current_profile_id())
  or (public.current_role() = 'Super Admin' and (select t.campus from public.teams t where t.id = problem_statement_selections.team_id) = public.current_campus())
);

-- problem_statement_extensions.ps_extensions_select (source 0001)
drop policy if exists ps_extensions_select on public.problem_statement_extensions;
create policy ps_extensions_select on public.problem_statement_extensions for select to authenticated
using (
  team_id = public.current_team_id()
  or team_id in (select id from public.teams where spoc_profile_id = public.current_profile_id())
  or (public.current_role() = 'Super Admin' and (select t.campus from public.teams t where t.id = problem_statement_extensions.team_id) = public.current_campus())
);

-- attendance.attendance_select (source 0001)
drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance for select to authenticated
using (
  team_id = public.current_team_id()
  or team_id in (select id from public.teams where spoc_profile_id = public.current_profile_id())
  or (public.current_role() = 'Super Admin' and (select t.campus from public.teams t where t.id = attendance.team_id) = public.current_campus())
);

-- attendance_audit_log.attendance_audit_select (source 0001)
drop policy if exists attendance_audit_select on public.attendance_audit_log;
create policy attendance_audit_select on public.attendance_audit_log for select to authenticated
using (
  (public.current_role() = 'Super Admin' and (select t.campus from public.attendance a join public.teams t on t.id = a.team_id where a.id = attendance_audit_log.attendance_id) = public.current_campus())
  or exists (
    select 1 from public.attendance a
    join public.teams t on t.id = a.team_id
    where a.id = attendance_audit_log.attendance_id
    and t.spoc_profile_id = public.current_profile_id()
  )
);

-- food_coupons.food_coupons_select (source 0001)
drop policy if exists food_coupons_select on public.food_coupons;
create policy food_coupons_select on public.food_coupons for select to authenticated
using (
  profile_id in (select profile_id from public.team_members where team_id = public.current_team_id())
  or profile_id in (
    select tm.profile_id from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where t.spoc_profile_id = public.current_profile_id()
  )
  or (public.current_role() = 'Super Admin' and (select t.campus from public.team_members tm join public.teams t on t.id = tm.team_id where tm.profile_id = food_coupons.profile_id) = public.current_campus())
);

-- nocs.nocs_select (source 0001)
drop policy if exists nocs_select on public.nocs;
create policy nocs_select on public.nocs for select to authenticated
using (
  profile_id = public.current_profile_id()
  or (
    public.current_role() = 'Team Lead'
    and profile_id in (select profile_id from public.team_members where team_id = public.current_team_id())
  )
  or profile_id in (
    select tm.profile_id from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where t.spoc_profile_id = public.current_profile_id()
  )
  or (
    public.current_role() = 'Super Admin'
    and (select t.campus from public.team_members tm join public.teams t on t.id = tm.team_id where tm.profile_id = nocs.profile_id) = public.current_campus()
  )
);

-- noc_audit_log.noc_audit_select (source 0001)
drop policy if exists noc_audit_select on public.noc_audit_log;
create policy noc_audit_select on public.noc_audit_log for select to authenticated
using (
  (public.current_role() = 'Super Admin' and (select t.campus from public.nocs n join public.team_members tm on tm.profile_id = n.profile_id join public.teams t on t.id = tm.team_id where n.id = noc_audit_log.noc_id) = public.current_campus())
  or exists (
    select 1 from public.nocs n
    join public.team_members tm on tm.profile_id = n.profile_id
    join public.teams t on t.id = tm.team_id
    where n.id = noc_audit_log.noc_id
    and (
      (public.current_role() = 'Team Lead' and tm.team_id = public.current_team_id())
      or t.spoc_profile_id = public.current_profile_id()
    )
  )
);

-- exit_forms.exit_forms_select (source 0001)
drop policy if exists exit_forms_select on public.exit_forms;
create policy exit_forms_select on public.exit_forms for select to authenticated
using (
  team_id = public.current_team_id()
  or team_id in (select id from public.teams where spoc_profile_id = public.current_profile_id())
  or (public.current_role() = 'Super Admin' and (select t.campus from public.teams t where t.id = exit_forms.team_id) = public.current_campus())
);

-- approval_requests.approval_requests_select (source 0001)
drop policy if exists approval_requests_select on public.approval_requests;
create policy approval_requests_select on public.approval_requests for select to authenticated
using (
  team_id = public.current_team_id()
  or team_id in (select id from public.teams where spoc_profile_id = public.current_profile_id())
  or (public.current_role() = 'Super Admin' and (select t.campus from public.teams t where t.id = approval_requests.team_id) = public.current_campus())
);

-- audit_logs.audit_logs_select (source 0001)
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs for select to authenticated
using (
  (public.current_role() = 'Super Admin' and (select p.campus from public.profiles p where p.id = audit_logs.actor_profile_id) = public.current_campus())
);

-- presentations.presentations_select (source 0009)
drop policy if exists presentations_select on public.presentations;
create policy presentations_select on public.presentations for select to authenticated
using (
  team_id = public.current_team_id()
  or team_id in (select id from public.teams where spoc_profile_id = public.current_profile_id())
  or (public.current_role() = 'Super Admin' and (select t.campus from public.teams t where t.id = presentations.team_id) = public.current_campus())
);

-- exit_requests.exit_requests_select (source 0012)
drop policy if exists exit_requests_select on public.exit_requests;
create policy exit_requests_select on public.exit_requests for select to authenticated
using (
  profile_id = public.current_profile_id()
  or public.is_led_profile(profile_id)
  or public.is_assigned_spoc_of_profile(profile_id)
  or (public.current_role() = 'Super Admin' and (select t.campus from public.teams t where t.id = exit_requests.team_id) = public.current_campus())
);

-- zones / rooms: replace the blanket `using (true)` (from 0006) with a
-- real same-campus predicate — everyone still resolves names within their campus.
drop policy if exists zones_select on public.zones;
create policy zones_select on public.zones for select to authenticated
using (campus = public.current_campus());

drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms for select to authenticated
using (campus = public.current_campus());

-- ── Storage-object policies: scope the Super-Admin branch to current_campus() ──
-- First path segment `(storage.foldername(name))[1]::uuid` is a PROFILE id in
-- the noc-uploads bucket (use is_same_campus_profile) and a TEAM id in
-- exit-forms / ppt-uploads (use is_same_campus_team). Bodies copied verbatim
-- from their source migrations; only the bare
-- `public.current_role() = 'Super Admin'` clause changes. The *_insert storage
-- policies have no Super-Admin branch and are left untouched.

-- noc-uploads bucket (source 0002; noc_uploads_update/_delete bodies confirmed
-- unchanged by 0005's ALTER POLICY).
drop policy if exists noc_uploads_select on storage.objects;
create policy noc_uploads_select on storage.objects for select to authenticated
using (
  bucket_id = 'noc-uploads'
  and (
    public.is_own_or_led_profile((storage.foldername(name))[1]::uuid)
    or public.is_assigned_spoc_of_profile((storage.foldername(name))[1]::uuid)
    or (public.current_role() = 'Super Admin' and public.is_same_campus_profile((storage.foldername(name))[1]::uuid))
  )
);

drop policy if exists noc_uploads_update on storage.objects;
create policy noc_uploads_update on storage.objects for update to authenticated
using (
  bucket_id = 'noc-uploads'
  and (
    public.is_led_profile((storage.foldername(name))[1]::uuid)
    or public.is_assigned_spoc_of_profile((storage.foldername(name))[1]::uuid)
    or (public.current_role() = 'Super Admin' and public.is_same_campus_profile((storage.foldername(name))[1]::uuid))
  )
)
with check (
  bucket_id = 'noc-uploads'
  and (
    public.is_led_profile((storage.foldername(name))[1]::uuid)
    or public.is_assigned_spoc_of_profile((storage.foldername(name))[1]::uuid)
    or (public.current_role() = 'Super Admin' and public.is_same_campus_profile((storage.foldername(name))[1]::uuid))
  )
);

drop policy if exists noc_uploads_delete on storage.objects;
create policy noc_uploads_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'noc-uploads'
  and (
    public.is_led_profile((storage.foldername(name))[1]::uuid)
    or public.is_assigned_spoc_of_profile((storage.foldername(name))[1]::uuid)
    or (public.current_role() = 'Super Admin' and public.is_same_campus_profile((storage.foldername(name))[1]::uuid))
  )
);

-- exit-forms bucket (source 0002).
drop policy if exists exit_forms_select_storage on storage.objects;
create policy exit_forms_select_storage on storage.objects for select to authenticated
using (
  bucket_id = 'exit-forms'
  and (
    public.is_own_team((storage.foldername(name))[1]::uuid)
    or public.is_assigned_spoc_of_team((storage.foldername(name))[1]::uuid)
    or (public.current_role() = 'Super Admin' and public.is_same_campus_team((storage.foldername(name))[1]::uuid))
  )
);

drop policy if exists exit_forms_update_storage on storage.objects;
create policy exit_forms_update_storage on storage.objects for update to authenticated
using (
  bucket_id = 'exit-forms'
  and (public.is_led_team((storage.foldername(name))[1]::uuid) or (public.current_role() = 'Super Admin' and public.is_same_campus_team((storage.foldername(name))[1]::uuid)))
)
with check (
  bucket_id = 'exit-forms'
  and (public.is_led_team((storage.foldername(name))[1]::uuid) or (public.current_role() = 'Super Admin' and public.is_same_campus_team((storage.foldername(name))[1]::uuid)))
);

drop policy if exists exit_forms_delete_storage on storage.objects;
create policy exit_forms_delete_storage on storage.objects for delete to authenticated
using (
  bucket_id = 'exit-forms'
  and (public.is_led_team((storage.foldername(name))[1]::uuid) or (public.current_role() = 'Super Admin' and public.is_same_campus_team((storage.foldername(name))[1]::uuid)))
);

-- ppt-uploads bucket (source 0009).
-- NOTE: ppt_uploads_update is NOT recreated here. Migration 0018
-- (0018_ppt_pdf_only_16mb_lead_only.sql) deliberately dropped its Super-Admin
-- branch ("close the storage-level Super Admin insert/update loophole"), so its
-- current body has no `public.current_role() = 'Super Admin'` clause to scope —
-- same situation as the *_insert policies. Recreating it from 0009 would
-- reintroduce the loophole 0018 closed, so it is left as 0018 defined it.
drop policy if exists ppt_uploads_select on storage.objects;
create policy ppt_uploads_select on storage.objects for select to authenticated
using (
  bucket_id = 'ppt-uploads'
  and (
    public.is_own_team((storage.foldername(name))[1]::uuid)
    or public.is_assigned_spoc_of_team((storage.foldername(name))[1]::uuid)
    or (public.current_role() = 'Super Admin' and public.is_same_campus_team((storage.foldername(name))[1]::uuid))
  )
);

drop policy if exists ppt_uploads_delete on storage.objects;
create policy ppt_uploads_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'ppt-uploads'
  and (public.is_led_team((storage.foldername(name))[1]::uuid) or (public.current_role() = 'Super Admin' and public.is_same_campus_team((storage.foldername(name))[1]::uuid)))
);

-- ══════════════════════════════════════════════════════════════════════════
-- Task 5: Campus-setting RPCs — register_team / create_staff_profile /
-- create_room / create_zone stamp the campus onto every row they create.
-- Bodies below are the current definitions (register_team=0006,
-- create_staff_profile=0004, create_room/create_zone=0006) with ONLY the
-- campus-stamp change; every revoke/grant is unchanged.
-- ══════════════════════════════════════════════════════════════════════════

-- register_team (source 0006): add v_campus local, validate it, replace the
-- two 'VSP' literals, and stamp teams.campus on the insert.
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
  v_idx int := 0;
  v_profile_id uuid;
  v_user_id text;
  v_user_ids text[] := '{}';
  v_lead_profile_id uuid;
begin
  if v_campus is null or v_campus not in ('VSP', 'BLR', 'HYD') then
    raise exception 'INVALID_CAMPUS';
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

  v_team_code := public.next_team_id();

  insert into public.teams (team_id, team_name, member_count, status, campus)
  values (v_team_code, v_team_name, v_member_count, 'Registered', v_campus::public.campus)
  returning id into v_team_id;

  for v_member in select * from jsonb_array_elements(v_members) loop
    v_user_id := public.next_user_id(v_campus);

    insert into public.profiles (
      user_id, campus, role, name, gitam_email, phone, reg_no,
      year_of_study, school, department, branch, gender, stay
    ) values (
      v_user_id, v_campus::public.campus,
      case when v_idx = 0 then 'Team Lead' else 'Member' end::public.user_role,
      v_member->>'name', lower(v_member->>'gitamEmail'), v_member->>'phone', v_member->>'regNo',
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

-- create_staff_profile (source 0004): 'VSP' replaced by public.current_campus().
create or replace function public.create_staff_profile(p_name text, p_email text, p_role text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_user_id text;
  v_campus public.campus := public.current_campus();
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
  if p_role not in ('SPOC', 'Super Admin') then raise exception 'INVALID_ROLE'; end if;
  if exists (select 1 from public.profiles where gitam_email = lower(p_email)) then
    raise exception 'DUPLICATE_EMAIL:%', p_email;
  end if;

  v_user_id := public.next_user_id(v_campus::text);

  insert into public.profiles (user_id, campus, role, name, gitam_email)
  values (v_user_id, v_campus, p_role::public.user_role, p_name, lower(p_email))
  returning id into v_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Staff Account Created', 'profile', v_id,
          jsonb_build_object('role', p_role, 'email', p_email, 'campus', v_campus));

  return v_id;
end;
$$;

revoke all on function public.create_staff_profile(text, text, text) from public, anon;
grant execute on function public.create_staff_profile(text, text, text) to authenticated;

-- create_room / create_zone (source 0006): add campus to the insert.
create or replace function public.create_room(p_name text, p_zone_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;

  insert into public.rooms (name, zone_id, campus)
  values (p_name, p_zone_id, public.current_campus()) returning id into v_id;

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

  insert into public.zones (name, zone_manager_profile_id, campus)
  values (p_name, p_manager_profile_id, public.current_campus()) returning id into v_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Zone Created', 'zone', v_id, jsonb_build_object('name', p_name));

  return v_id;
exception
  when unique_violation then raise exception 'DUPLICATE_ZONE_NAME';
end;
$$;
revoke all on function public.create_zone(text, uuid) from public, anon;
grant execute on function public.create_zone(text, uuid) to authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- Task 6: CROSS_CAMPUS guards on assignment + admin-mutation RPCs.
-- Each function below is its CURRENT definition copied verbatim (latest
-- source noted per RPC) with exactly ONE guard line/block inserted after the
-- existing authorization check. Every revoke/grant is byte-for-byte the
-- source's. Campus comparison uses `is distinct from` so NULL is handled.
-- ══════════════════════════════════════════════════════════════════════════

-- ── 6a — Assignment RPCs ────────────────────────────────────────────────

-- assign_spoc_to_room (source 0006)
create or replace function public.assign_spoc_to_room(p_room_id uuid, p_spoc_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
  if p_spoc_profile_id is not null and (select campus from public.profiles where id = p_spoc_profile_id) is distinct from (select campus from public.rooms where id = p_room_id) then raise exception 'CROSS_CAMPUS'; end if;
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

-- assign_team_to_room (source 0006) — guard placed before the p_room_id-null short-circuit
create or replace function public.assign_team_to_room(p_team_id uuid, p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_spoc uuid;
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;

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
$$;
revoke all on function public.assign_team_to_room(uuid, uuid) from public, anon;
grant execute on function public.assign_team_to_room(uuid, uuid) to authenticated;

-- assign_room_to_zone (source 0006)
create or replace function public.assign_room_to_zone(p_room_id uuid, p_zone_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
  if p_zone_id is not null and (select campus from public.rooms where id = p_room_id) is distinct from (select campus from public.zones where id = p_zone_id) then raise exception 'CROSS_CAMPUS'; end if;
  update public.rooms set zone_id = p_zone_id, updated_at = now() where id = p_room_id;
end;
$$;
revoke all on function public.assign_room_to_zone(uuid, uuid) from public, anon;
grant execute on function public.assign_room_to_zone(uuid, uuid) to authenticated;

-- assign_zone_manager (source 0006)
create or replace function public.assign_zone_manager(p_zone_id uuid, p_manager_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
  if p_manager_profile_id is not null and (select campus from public.profiles where id = p_manager_profile_id) is distinct from (select campus from public.zones where id = p_zone_id) then raise exception 'CROSS_CAMPUS'; end if;

  update public.zones set zone_manager_profile_id = p_manager_profile_id, updated_at = now() where id = p_zone_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Zone Manager Assigned', 'zone', p_zone_id, jsonb_build_object('manager_profile_id', p_manager_profile_id));
end;
$$;
revoke all on function public.assign_zone_manager(uuid, uuid) from public, anon;
grant execute on function public.assign_zone_manager(uuid, uuid) to authenticated;

-- assign_spoc (source 0003 — direct team<->SPOC assignment, still present)
create or replace function public.assign_spoc(p_team_id uuid, p_spoc_profile_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if public.current_role() <> 'Super Admin' then
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
$$;

revoke all on function public.assign_spoc(uuid, uuid) from public, anon;
grant execute on function public.assign_spoc(uuid, uuid) to authenticated;

-- ── 6b — Admin-only mutation RPCs ──────────────────────────────────────
-- Guard shape: if <target campus lookup> is distinct from public.current_campus()
-- then raise exception 'CROSS_CAMPUS'; end if;  — inserted after the existing
-- authorization check.

-- delete_team (source 0012)
create or replace function public.delete_team(p_team_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_profile_id uuid;
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
  if (select campus from public.teams where id = p_team_id) is distinct from public.current_campus() then
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
$$;
revoke all on function public.delete_team(uuid) from public, anon;
grant execute on function public.delete_team(uuid) to authenticated;

-- delete_member (source 0024)
create or replace function public.delete_member(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
  if (select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus() then
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
$$;
revoke all on function public.delete_member(uuid) from public, anon;
grant execute on function public.delete_member(uuid) to authenticated;

-- delete_spoc (source 0006)
create or replace function public.delete_spoc(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
  if (select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus() then
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
$$;
revoke all on function public.delete_spoc(uuid) from public, anon;
grant execute on function public.delete_spoc(uuid) to authenticated;

-- delete_noc (source 0016)
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
  if (select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus() then
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
$$;
revoke all on function public.delete_noc(uuid) from public, anon;
grant execute on function public.delete_noc(uuid) to authenticated;

-- delete_presentation (source 0009)
create or replace function public.delete_presentation(p_team_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_led_team(p_team_id) or public.current_role() = 'Super Admin') then
    raise exception 'NOT_ALLOWED';
  end if;
  if (select campus from public.teams where id = p_team_id) is distinct from public.current_campus() then
    raise exception 'CROSS_CAMPUS';
  end if;

  update public.presentations set status = 'Not Uploaded', file_path = null where team_id = p_team_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'Presentation Deleted', 'presentation', p_team_id);
end;
$$;
revoke all on function public.delete_presentation(uuid) from public, anon;
grant execute on function public.delete_presentation(uuid) to authenticated;

-- delete_exit_request (source 0012)
create or replace function public.delete_exit_request(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_led_profile(p_profile_id) or public.current_role() = 'Super Admin') then
    raise exception 'NOT_ALLOWED';
  end if;
  if (select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus() then
    raise exception 'CROSS_CAMPUS';
  end if;

  delete from public.exit_requests where profile_id = p_profile_id;
end;
$$;
revoke all on function public.delete_exit_request(uuid) from public, anon;
grant execute on function public.delete_exit_request(uuid) to authenticated;

-- update_member (source 0007)
create or replace function public.update_member(
  p_profile_id uuid,
  p_name text,
  p_gitam_email text,
  p_phone text,
  p_reg_no text,
  p_year_of_study text,
  p_school text,
  p_department text,
  p_branch text,
  p_gender text,
  p_stay text
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
  if (select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus() then
    raise exception 'CROSS_CAMPUS';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'PARTICIPANT_NOT_FOUND';
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

  update public.profiles set
    name = p_name,
    gitam_email = lower(p_gitam_email),
    phone = p_phone,
    reg_no = p_reg_no,
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
$$;
revoke all on function public.update_member(uuid, text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.update_member(uuid, text, text, text, text, text, text, text, text, text, text) to authenticated;

-- update_team_name (source 0007)
create or replace function public.update_team_name(p_team_id uuid, p_team_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
  if (select campus from public.teams where id = p_team_id) is distinct from public.current_campus() then
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
$$;
revoke all on function public.update_team_name(uuid, text) from public, anon;
grant execute on function public.update_team_name(uuid, text) to authenticated;

-- update_user_role (source 0003) — single guard also covers the
-- "promote to Super Admin in another campus" case.
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
  if (select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus() then
    raise exception 'CROSS_CAMPUS';
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

-- change_team_lead (source 0022)
create or replace function public.change_team_lead(p_team_id uuid, p_new_lead_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_old_lead_profile_id uuid;
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
  if (select campus from public.teams where id = p_team_id) is distinct from public.current_campus() then
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
$$;
revoke all on function public.change_team_lead(uuid, uuid) from public, anon;
grant execute on function public.change_team_lead(uuid, uuid) to authenticated;

-- admin_set_problem_statement (source 0023)
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
  if (select campus from public.teams where id = p_team_id) is distinct from public.current_campus() then
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
$$;
revoke all on function public.admin_set_problem_statement(uuid, text) from public, anon;
grant execute on function public.admin_set_problem_statement(uuid, text) to authenticated;

-- record_attendance (source 0003)
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
  if (select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus() then
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
$$;

revoke all on function public.record_attendance(uuid, uuid, text) from public, anon;
grant execute on function public.record_attendance(uuid, uuid, text) to authenticated;

-- record_food_redemption (source 0003)
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
  if (select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus() then
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
$$;

revoke all on function public.record_food_redemption(uuid, text, text) from public, anon;
grant execute on function public.record_food_redemption(uuid, text, text) to authenticated;

-- resolve_approval_request (source 0003)
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
  if (select t.campus from public.approval_requests ar join public.teams t on t.id = ar.team_id where ar.id = p_request_id) is distinct from public.current_campus() then
    raise exception 'CROSS_CAMPUS';
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

-- resolve_member_exit (source 0012)
create or replace function public.resolve_member_exit(p_request_id uuid, p_decision text)
returns void language plpgsql security definer set search_path = public as $$
declare v_profile_id uuid; v_team_id uuid;
begin
  if p_decision not in ('Approved', 'Rejected') then raise exception 'INVALID_DECISION'; end if;

  select profile_id, team_id into v_profile_id, v_team_id from public.exit_requests where id = p_request_id;
  if v_profile_id is null then raise exception 'REQUEST_NOT_FOUND'; end if;

  if not (public.is_assigned_spoc_of_team(v_team_id) or public.current_role() = 'Super Admin') then
    raise exception 'NOT_ALLOWED';
  end if;
  if (select t.campus from public.exit_requests er join public.teams t on t.id = er.team_id where er.id = p_request_id) is distinct from public.current_campus() then
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
$$;
revoke all on function public.resolve_member_exit(uuid, text) from public, anon;
grant execute on function public.resolve_member_exit(uuid, text) to authenticated;

-- extend_noc_deadline (source 0016)
create or replace function public.extend_noc_deadline(p_profile_id uuid, p_deadline timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_assigned_spoc_of_profile(p_profile_id) or public.current_role() = 'Super Admin') then
    raise exception 'NOT_ALLOWED';
  end if;
  if (select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus() then
    raise exception 'CROSS_CAMPUS';
  end if;

  insert into public.nocs (profile_id, deadline) values (p_profile_id, p_deadline)
  on conflict (profile_id) do update set deadline = excluded.deadline, updated_at = now();
end;
$$;
revoke all on function public.extend_noc_deadline(uuid, timestamptz) from public, anon;
grant execute on function public.extend_noc_deadline(uuid, timestamptz) to authenticated;

-- extend_presentation_deadline (source 0019)
create or replace function public.extend_presentation_deadline(p_team_id uuid, p_deadline timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_assigned_spoc_of_team(p_team_id) or public.current_role() = 'Super Admin') then
    raise exception 'NOT_ALLOWED';
  end if;
  if (select campus from public.teams where id = p_team_id) is distinct from public.current_campus() then
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
$$;
revoke all on function public.extend_presentation_deadline(uuid, timestamptz) from public, anon;
grant execute on function public.extend_presentation_deadline(uuid, timestamptz) to authenticated;

-- extend_problem_statement_deadline (source 0003)
create or replace function public.extend_problem_statement_deadline(p_team_id uuid, p_extended_until timestamptz, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not (public.is_assigned_spoc_of_team(p_team_id) or public.current_role() = 'Super Admin') then
    raise exception 'NOT_ALLOWED';
  end if;
  if (select campus from public.teams where id = p_team_id) is distinct from public.current_campus() then
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
$$;

revoke all on function public.extend_problem_statement_deadline(uuid, timestamptz, text) from public, anon;
grant execute on function public.extend_problem_statement_deadline(uuid, timestamptz, text) to authenticated;

-- ── 6c — Mixed-caller RPCs (Team Lead OR admin) ───────────────────────────
-- record_noc_metadata (source 0019): the ONLY admin path is the
-- `public.current_role() = 'Super Admin'` branch of the authorization check
-- (0018 made presentation uploads lead-only; NOC uploads still let a Super
-- Admin upload on someone's behalf). The guard below is gated on that branch
-- so the team-lead / self path is untouched.
create or replace function public.record_noc_metadata(p_profile_id uuid, p_file_path text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_action text;
  v_noc_id uuid;
  v_deadline timestamptz;
begin
  if not (public.is_own_or_led_profile(p_profile_id) or public.current_role() = 'Super Admin') then
    raise exception 'NOT_ALLOWED';
  end if;
  if public.current_role() = 'Super Admin' and (select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus() then
    raise exception 'CROSS_CAMPUS';
  end if;

  select deadline into v_deadline from public.nocs where profile_id = p_profile_id;
  if v_deadline is not null and now() > v_deadline and public.current_role() <> 'Super Admin' then
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
$$;
revoke all on function public.record_noc_metadata(uuid, text) from public, anon;
grant execute on function public.record_noc_metadata(uuid, text) to authenticated;

-- record_presentation (source 0019) and record_exit_form (source 0002):
-- NO guard added. Their current bodies are Team-Lead-only
-- (`if not public.is_led_team(p_team_id) then raise 'NOT_TEAM_LEAD'`) — 0018
-- removed every admin upload path for presentations and record_exit_form
-- never had one. Task 6c says to add the guard ONLY inside an admin branch
-- and never on the team-lead path; with no admin branch to hang it on there
-- is nothing to guard (a Team Lead is intrinsically in their own campus).
-- Flagged to the controller as NEEDS_CONTEXT.

-- ══════════════════════════════════════════════════════════════════════════
-- Task 7: Per-campus notification scoping + campus Super Admin seeds.
-- ══════════════════════════════════════════════════════════════════════════

-- Step 1 — "new team registration" admin notification: NO-OP.
-- No function or trigger anywhere in 0001-0024 inserts a "New Team
-- Registration" (or equivalent) notification for staff on team registration.
-- register_team (0006) sends no notification at all, and the only
-- registration-adjacent staff notification is 'TeamEditRequested' from
-- request_team_edit (0002), which is an edit-approval request, not a new
-- registration. There is nothing to scope here.

-- Step 2 — broadcast_notification (source 0017): every recipient-selecting
-- query gains `and campus = public.current_campus()` (aliased `t.campus` for
-- the venue branch). Audience-branching logic is otherwise identical.
create or replace function public.broadcast_notification(
  p_title text,
  p_message text,
  p_audience_type text,
  p_audience_value text
)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
  if trim(p_title) = '' or trim(p_message) = '' then raise exception 'INVALID_BROADCAST'; end if;

  if p_audience_type = 'all' then
    insert into public.notifications (recipient_profile_id, type, title, message)
    select id, 'AdminBroadcast', p_title, p_message
    from public.profiles
    where role in ('Member', 'Team Lead', 'SPOC') and campus = public.current_campus();

  elsif p_audience_type = 'role' then
    if p_audience_value not in ('Member', 'Team Lead', 'SPOC') then raise exception 'INVALID_AUDIENCE'; end if;

    insert into public.notifications (recipient_profile_id, type, title, message)
    select id, 'AdminBroadcast', p_title, p_message
    from public.profiles
    where role = p_audience_value::public.user_role and campus = public.current_campus();

  elsif p_audience_type = 'venue' then
    if not exists (select 1 from public.rooms where id = p_audience_value::uuid) then
      raise exception 'ROOM_NOT_FOUND';
    end if;

    insert into public.notifications (recipient_profile_id, type, title, message)
    select tm.profile_id, 'AdminBroadcast', p_title, p_message
    from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where t.room_id = p_audience_value::uuid and t.campus = public.current_campus();

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
$$;
revoke all on function public.broadcast_notification(text, text, text, text) from public, anon;
grant execute on function public.broadcast_notification(text, text, text, text) to authenticated;

-- Step 3 — seed helper + the three campus Super Admin seed calls.

-- One-shot seeding for the three campus Super Admins. No current_role() check
-- (only the migration calls it); revoked from every client role afterwards.
create or replace function public.seed_campus_super_admin(p_campus public.campus, p_email text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if exists (select 1 from public.profiles where gitam_email = lower(p_email)) then
    return null;  -- idempotent: already seeded
  end if;
  insert into public.profiles (user_id, campus, role, name, gitam_email)
  values (public.next_user_id(p_campus::text), p_campus, 'Super Admin',
          'Super Admin (' || p_campus::text || ')', lower(p_email))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.seed_campus_super_admin(public.campus, text) from public, anon, authenticated;

-- ⚠️ Replace the three placeholder emails before applying this migration.
select public.seed_campus_super_admin('VSP', 'REPLACE_VSP_ADMIN_EMAIL');
select public.seed_campus_super_admin('BLR', 'REPLACE_BLR_ADMIN_EMAIL');
select public.seed_campus_super_admin('HYD', 'REPLACE_HYD_ADMIN_EMAIL');

-- ── Storage policy campus gaps (controller ruling, Batch A review) ──
-- Two storage policies with an unscoped Super-Admin branch that Task 4 did
-- not cover. Scoped here the same way Batch A scoped the others: drop+create,
-- body copied verbatim from source, only the Super-Admin clause changed to
-- also require public.is_same_campus_profile() on the path's profile-id
-- segment.

-- 1) noc_uploads_insert — latest def in 0015_noc_deadline_and_admin_upload.sql.
drop policy if exists noc_uploads_insert on storage.objects;
create policy noc_uploads_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'noc-uploads'
  and (public.is_own_or_led_profile((storage.foldername(name))[1]::uuid) or (public.current_role() = 'Super Admin' and public.is_same_campus_profile((storage.foldername(name))[1]::uuid)))
);

-- 2) exit_requests_{select,update,delete}_storage — defined in
-- 0012_member_exit_requests.sql. Path segment 1 is a PROFILE id.
drop policy if exists exit_requests_select_storage on storage.objects;
create policy exit_requests_select_storage on storage.objects for select to authenticated
using (
  bucket_id = 'exit-requests'
  and (
    public.is_own_or_led_profile((storage.foldername(name))[1]::uuid)
    or public.is_assigned_spoc_of_profile((storage.foldername(name))[1]::uuid)
    or (public.current_role() = 'Super Admin' and public.is_same_campus_profile((storage.foldername(name))[1]::uuid))
  )
);

drop policy if exists exit_requests_update_storage on storage.objects;
create policy exit_requests_update_storage on storage.objects for update to authenticated
using (
  bucket_id = 'exit-requests'
  and (public.is_led_profile((storage.foldername(name))[1]::uuid) or (public.current_role() = 'Super Admin' and public.is_same_campus_profile((storage.foldername(name))[1]::uuid)))
)
with check (
  bucket_id = 'exit-requests'
  and (public.is_led_profile((storage.foldername(name))[1]::uuid) or (public.current_role() = 'Super Admin' and public.is_same_campus_profile((storage.foldername(name))[1]::uuid)))
);

drop policy if exists exit_requests_delete_storage on storage.objects;
create policy exit_requests_delete_storage on storage.objects for delete to authenticated
using (
  bucket_id = 'exit-requests'
  and (public.is_led_profile((storage.foldername(name))[1]::uuid) or (public.current_role() = 'Super Admin' and public.is_same_campus_profile((storage.foldername(name))[1]::uuid)))
);
