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
