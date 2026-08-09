-- TMCG IdeaSprint 4.0 — initial schema (Phase 4)
-- Full entity set per SPEC.md §94, RLS per the role matrix in SPEC.md §27-28,
-- §69-72, §68-69. Every table gets a SELECT policy in this migration; write
-- access goes exclusively through SECURITY DEFINER RPCs (register_team here,
-- one per mutation added alongside each feature in later phases) — no
-- INSERT/UPDATE/DELETE grants to `authenticated` anywhere in this file.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ── Enums ────────────────────────────────────────────────────────────────

create type public.user_role as enum ('Super Admin','SPOC','Team Lead','Member');
create type public.team_status as enum ('Registered','Active','Pending Approval','Qualified for Grand Finale','Exited');
create type public.ps_status as enum ('Hidden','Released');
create type public.attendance_status as enum ('Present','Absent');
create type public.meal_status as enum ('Not Redeemed','Redeemed');
create type public.noc_status as enum ('Not Uploaded','Uploaded','Verified','Missing');
create type public.exit_status as enum ('Not Submitted','Submitted','Verified','Exited');
create type public.approval_status as enum ('Pending','Approved','Rejected');

-- ── ID generation support (never exposed directly to PostgREST) ────────────

create table public.campus_counters (
  campus_code text primary key,
  next_user_seq integer not null default 1001
);
insert into public.campus_counters (campus_code, next_user_seq) values ('VSP', 1001);

create sequence public.team_id_seq start 1;

-- ── Core tables ──────────────────────────────────────────────────────────

-- Bridges registration-time participant data to auth.users. Registration
-- (pre-login) creates this row with auth_user_id = NULL; the participant's
-- first successful Google login links it by matching lowercased email
-- (SPEC §16-17: registration happens before any auth exists).
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  user_id text unique not null,           -- public-facing ID, e.g. "VSP1001"
  campus text not null default 'VSP',
  role public.user_role not null default 'Member',
  name text not null,
  gitam_email citext unique not null,
  phone text unique not null,
  reg_no text unique not null,
  year_of_study text not null,
  school text not null,
  department text not null,
  branch text not null,
  gender text not null,
  stay text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  team_id text unique not null,           -- e.g. "IS4-0001"
  team_name citext unique not null,
  domain_id text not null,                -- matches site-config Domain.id — no FK yet, domains aren't DB-backed until Phase 6
  member_count smallint not null check (member_count in (3,4)), -- total incl. Team Lead (SPEC §11: 3-4 total = lead + 2-3 members)
  team_lead_profile_id uuid references public.profiles(id),
  spoc_profile_id uuid references public.profiles(id),
  status public.team_status not null default 'Registered',
  current_problem_statement_id uuid,      -- FK added below, after problem_statements exists
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  is_lead boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (profile_id) -- SPEC §12/92: a participant belongs to only one team, platform-wide
);

create table public.problem_statements (
  id uuid primary key default gen_random_uuid(),
  number text unique not null,
  title text not null,
  description text,
  status public.ps_status not null default 'Hidden',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.teams
  add constraint teams_current_ps_fk foreign key (current_problem_statement_id) references public.problem_statements(id);

create table public.problem_statement_selections (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  problem_statement_id uuid not null references public.problem_statements(id),
  selected_by uuid not null references public.profiles(id),
  selected_at timestamptz not null default now(),
  is_initial boolean not null default false
);

create table public.problem_statement_extensions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid unique not null references public.teams(id) on delete cascade,
  extended_until timestamptz not null,
  duration_minutes integer,
  reason text,
  granted_by uuid not null references public.profiles(id),
  granted_at timestamptz not null default now()
);

create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id),
  profile_id uuid not null references public.profiles(id),
  team_id uuid not null references public.teams(id),
  status public.attendance_status not null,
  recorded_by uuid not null references public.profiles(id),
  recorded_at timestamptz not null default now(),
  unique (session_id, profile_id) -- prevents double-marking (SPEC §95)
);

create table public.attendance_audit_log (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance(id) on delete cascade,
  previous_status public.attendance_status,
  new_status public.attendance_status not null,
  modified_by uuid not null references public.profiles(id),
  modified_at timestamptz not null default now()
);

create table public.food_coupons (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique not null references public.profiles(id),
  lunch_status public.meal_status not null default 'Not Redeemed',
  lunch_recorded_by uuid references public.profiles(id),
  lunch_recorded_at timestamptz,
  dinner_status public.meal_status not null default 'Not Redeemed',
  dinner_recorded_by uuid references public.profiles(id),
  dinner_recorded_at timestamptz
);

create table public.nocs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique not null references public.profiles(id),
  file_path text,
  status public.noc_status not null default 'Not Uploaded',
  uploaded_by uuid references public.profiles(id),
  uploaded_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.noc_audit_log (
  id uuid primary key default gen_random_uuid(),
  noc_id uuid not null references public.nocs(id) on delete cascade,
  action text not null,   -- 'Uploaded' | 'Replaced' | 'Deleted'
  performed_by uuid not null references public.profiles(id),
  performed_at timestamptz not null default now()
);

create table public.exit_forms (
  id uuid primary key default gen_random_uuid(),
  team_id uuid unique not null references public.teams(id),
  file_path text,
  status public.exit_status not null default 'Not Submitted',
  uploaded_by uuid references public.profiles(id),
  uploaded_at timestamptz
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  request_type text not null default 'Team Edit',
  requested_changes jsonb not null,
  current_snapshot jsonb not null,
  requested_by uuid not null references public.profiles(id),
  status public.approval_status not null default 'Pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
-- SPEC §26: Team Lead cannot submit another request while one is pending
create unique index approval_requests_one_pending_per_team
  on public.approval_requests (team_id) where status = 'Pending';

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create table public.configuration (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

-- ── RLS helper functions ────────────────────────────────────────────────
-- SECURITY DEFINER + explicit search_path is the standard Supabase hardening
-- pattern: these run as the migration-owner role, which bypasses RLS on the
-- tables they query internally, so calling them from a policy on `profiles`
-- or `team_members` does not recurse.

create or replace function public.current_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles where auth_user_id = auth.uid();
$$;

create or replace function public.current_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where auth_user_id = auth.uid();
$$;

create or replace function public.current_team_id()
returns uuid language sql stable security definer set search_path = public as $$
  select team_id from public.team_members where profile_id = public.current_profile_id();
$$;

-- ── Enable RLS everywhere ───────────────────────────────────────────────

alter table public.campus_counters enable row level security;
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.problem_statements enable row level security;
alter table public.problem_statement_selections enable row level security;
alter table public.problem_statement_extensions enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.attendance_audit_log enable row level security;
alter table public.food_coupons enable row level security;
alter table public.nocs enable row level security;
alter table public.noc_audit_log enable row level security;
alter table public.exit_forms enable row level security;
alter table public.notifications enable row level security;
alter table public.approval_requests enable row level security;
alter table public.audit_logs enable row level security;
alter table public.configuration enable row level security;

-- campus_counters: intentionally NO policies — unreachable except via
-- service_role or SECURITY DEFINER functions (next_user_id below).

-- ── SELECT policies ──────────────────────────────────────────────────────

create policy profiles_select on public.profiles for select to authenticated
using (
  auth_user_id = auth.uid()
  or id in (select profile_id from public.team_members where team_id = public.current_team_id())
  or id in (
    select tm.profile_id from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where t.spoc_profile_id = public.current_profile_id()
  )
  or public.current_role() = 'Super Admin'
);

create policy teams_select on public.teams for select to authenticated
using (
  id = public.current_team_id()
  or spoc_profile_id = public.current_profile_id()
  or public.current_role() = 'Super Admin'
);

create policy team_members_select on public.team_members for select to authenticated
using (
  team_id = public.current_team_id()
  or team_id in (select id from public.teams where spoc_profile_id = public.current_profile_id())
  or public.current_role() = 'Super Admin'
);

create policy problem_statements_select on public.problem_statements for select to authenticated
using (
  status = 'Released'
  or public.current_role() in ('SPOC','Super Admin')
);

create policy ps_selections_select on public.problem_statement_selections for select to authenticated
using (
  team_id = public.current_team_id()
  or team_id in (select id from public.teams where spoc_profile_id = public.current_profile_id())
  or public.current_role() = 'Super Admin'
);

create policy ps_extensions_select on public.problem_statement_extensions for select to authenticated
using (
  team_id = public.current_team_id()
  or team_id in (select id from public.teams where spoc_profile_id = public.current_profile_id())
  or public.current_role() = 'Super Admin'
);

create policy attendance_sessions_select on public.attendance_sessions for select to authenticated
using (true);

create policy attendance_select on public.attendance for select to authenticated
using (
  team_id = public.current_team_id()
  or team_id in (select id from public.teams where spoc_profile_id = public.current_profile_id())
  or public.current_role() = 'Super Admin'
);

-- SPEC §49: attendance audit history is visible only to admins (SPOC/Super Admin), not to teams.
create policy attendance_audit_select on public.attendance_audit_log for select to authenticated
using (
  public.current_role() = 'Super Admin'
  or exists (
    select 1 from public.attendance a
    join public.teams t on t.id = a.team_id
    where a.id = attendance_audit_log.attendance_id
    and t.spoc_profile_id = public.current_profile_id()
  )
);

create policy food_coupons_select on public.food_coupons for select to authenticated
using (
  profile_id in (select profile_id from public.team_members where team_id = public.current_team_id())
  or profile_id in (
    select tm.profile_id from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where t.spoc_profile_id = public.current_profile_id()
  )
  or public.current_role() = 'Super Admin'
);

create policy exit_forms_select on public.exit_forms for select to authenticated
using (
  team_id = public.current_team_id()
  or team_id in (select id from public.teams where spoc_profile_id = public.current_profile_id())
  or public.current_role() = 'Super Admin'
);

create policy approval_requests_select on public.approval_requests for select to authenticated
using (
  team_id = public.current_team_id()
  or team_id in (select id from public.teams where spoc_profile_id = public.current_profile_id())
  or public.current_role() = 'Super Admin'
);

-- SPEC §39-48: Member sees only their own NOC; Team Lead sees every teammate's.
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
  or public.current_role() = 'Super Admin'
);

create policy noc_audit_select on public.noc_audit_log for select to authenticated
using (
  public.current_role() = 'Super Admin'
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

create policy notifications_select on public.notifications for select to authenticated
using (recipient_profile_id = public.current_profile_id());

create policy audit_logs_select on public.audit_logs for select to authenticated
using (public.current_role() = 'Super Admin');

-- The one intentionally public-readable table — drives homepage content in Phase 6.
create policy configuration_select on public.configuration for select to anon, authenticated
using (true);

-- ── ID generation + registration RPC ────────────────────────────────────

create or replace function public.next_user_id(p_campus text)
returns text language plpgsql as $$
declare v_seq integer;
begin
  update public.campus_counters
     set next_user_seq = next_user_seq + 1
   where campus_code = p_campus
   returning next_user_seq - 1 into v_seq;
  if v_seq is null then
    raise exception 'Unknown campus code: %', p_campus;
  end if;
  return p_campus || v_seq::text;
end;
$$;

create or replace function public.next_team_id()
returns text language sql as $$
  select 'TeamID' || lpad(nextval('public.team_id_seq')::text, 2, '0');
$$;

-- Whole registration transaction: uniqueness re-check, team + profile + team_member
-- inserts, ID generation — atomic, correctness ultimately guaranteed by the
-- UNIQUE constraints above (the exists-checks below are just for a friendly
-- error message, not the authoritative enforcement).
create or replace function public.register_team(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_name text := p_payload->'team'->>'teamName';
  v_domain_id text := p_payload->'team'->>'domainId';
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

  insert into public.teams (team_id, team_name, domain_id, member_count, status)
  values (v_team_code, v_team_name, v_domain_id, v_member_count, 'Registered')
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
    -- Backstop for a race the pre-checks above missed — same error
    -- vocabulary so the caller doesn't need a second error-mapping path.
    raise exception 'DUPLICATE_ENTRY: %', sqlerrm;
end;
$$;

-- Only the service role may call this — registration must go through a
-- server action, never a direct anon/authenticated insert.
revoke all on function public.register_team(jsonb) from public, anon, authenticated;
grant execute on function public.register_team(jsonb) to service_role;

-- ── Availability checks (anon-safe: boolean-only, no raw table access) ──

create or replace function public.check_team_name_available(p_team_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.teams where team_name = p_team_name);
$$;
grant execute on function public.check_team_name_available(text) to anon, authenticated;

create or replace function public.check_participant_available(p_field text, p_value text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if p_field = 'gitamEmail' then
    return not exists (select 1 from public.profiles where gitam_email = lower(p_value));
  elsif p_field = 'regNo' then
    return not exists (select 1 from public.profiles where reg_no = p_value);
  elsif p_field = 'phone' then
    return not exists (select 1 from public.profiles where phone = p_value);
  else
    raise exception 'invalid field %', p_field;
  end if;
end;
$$;
grant execute on function public.check_participant_available(text, text) to anon, authenticated;
