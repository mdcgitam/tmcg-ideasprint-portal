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
