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
