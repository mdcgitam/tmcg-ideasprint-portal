# Campus Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the portal a three-campus system (VSP / BLR / HYD) where every role sees and mutates only its own campus's people, teams, and records.

**Architecture:** One new SQL migration (`0025_campus_isolation.sql`) adds a `campus` enum + columns, a `current_campus()` RLS helper, rewrites every "Super Admin sees all" policy branch to "Super Admin of the same campus", adds `CROSS_CAMPUS` guards to admin-mutation RPCs, seeds per-campus User ID counters and three campus Super Admin accounts. The app layer adds a Campus field to registration and a campus filter to the admin/SPOC dashboard data loader, plus read-only campus badges.

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase (Postgres + RLS + Storage), Zod, react-hook-form, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-05-campus-isolation-design.md` — read it before starting; this plan implements it section-for-section.

## Global Constraints

- **Campus codes:** `VSP`, `BLR`, `HYD` stored in DB. UI labels: `Visakhapatnam`, `Bangalore`, `Hyderabad`. (Spec D7)
- **Campus enum:** `public.campus as enum ('VSP','BLR','HYD')`. (Spec §4.1)
- **All Super Admins are campus-bound** — no global/root account, no campus switcher. (Spec D1)
- **Global tables, NOT campus-scoped:** `problem_statements`, `attendance_sessions`, `configuration`. (Spec D2)
- **Uniqueness stays platform-wide** for `gitam_email`, `phone`, `reg_no` — do not add campus to any unique constraint. (Spec D4)
- **User ID counters start at 1000** for all three campuses so first IDs are `VSP1000` / `BLR1000` / `HYD1000`. (Spec D6)
- **Every mutation goes through a SECURITY DEFINER RPC** — never grant INSERT/UPDATE/DELETE to `authenticated`. Match the conventions in `supabase/migrations/0001`–`0024`.
- **Migrations are applied by hand** (Supabase SQL Editor / `supabase db push`). There is no local Supabase and no test runner — `package.json` has only `dev` / `build` / `start` / `lint`.
- **Testing is deferred to the end** (per the user): implement all tasks, then run the single verification task (Task 9). Do not run `build`/`lint`/SQL between every task.
- One migration file, internally ordered: enum → columns → helpers → SELECT policies → storage policies → RPCs → notifications → seeds/backfill. RPC bodies use `create or replace` (same as `0006`).

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/0025_campus_isolation.sql` | **New.** The entire DB change (Tasks 1–7 all append to this one file). |
| `supabase/tests/campus_isolation.sql` | **New.** Read-only isolation assertions, pasted into the SQL Editor (Task 9). |
| `supabase/audit_check.sql` | **Modify.** Add campus enum/column/policy/function rows to the existing audit (Task 9). |
| `src/types/database.ts` | **Modify.** `CampusCode` type; `campus` on `ProfileRow` / `TeamRow` / `RoomRow` / `ZoneRow`. |
| `src/lib/registration/schema.ts` | **Modify.** `CAMPUS_OPTIONS`; `campus` on `teamDetailsSchema`. |
| `src/components/registration/RegistrationStepper.tsx` | **Modify.** Default value for `team.campus`; add it to the step-1 `trigger()` list. |
| `src/components/registration/steps/TeamDetailsStep.tsx` | **Modify.** Campus `<select>` as the first field. |
| `src/components/registration/steps/ReviewStep.tsx` | **Modify.** Show the chosen campus. |
| `src/lib/dashboard/admin-data.ts` | **Modify.** Campus narrowing for Super Admin; shared "cascade by team-id set" helper. |
| `src/components/dashboard/admin/sections/TeamsByTeamView.tsx` | **Modify.** Campus column (read-only). |
| `src/components/dashboard/admin/sections/TeamDetailModal.tsx` | **Modify.** Campus row (read-only). |
| `src/components/dashboard/admin/sections/StaffAccountsSection.tsx` | **Modify.** Campus column (read-only). |

---

## Task 1: Migration scaffold — enum, columns, counters

**Files:**
- Create: `supabase/migrations/0025_campus_isolation.sql`

**Interfaces:**
- Produces: `public.campus` enum; `profiles.campus` (converted to enum), `teams.campus`, `rooms.campus`, `zones.campus` (all `public.campus not null default 'VSP'`); `campus_counters` rows for `BLR` and `HYD` at 1000; VSP counter conditionally reset to 1000.

- [ ] **Step 1: Create the file with the header and this content**

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0025_campus_isolation.sql
git commit -m "Campus isolation: enum, campus columns, per-campus User ID counters"
```

---

## Task 2: `current_campus()` and storage-helper functions

**Files:**
- Modify: `supabase/migrations/0025_campus_isolation.sql` (append)

**Interfaces:**
- Consumes: `public.campus` enum, `profiles.campus`, `teams.campus` (Task 1).
- Produces: `public.current_campus() returns public.campus`; `public.is_same_campus_team(uuid) returns boolean`; `public.is_same_campus_profile(uuid) returns boolean`. All `stable security definer set search_path = public`.

- [ ] **Step 1: Append**

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0025_campus_isolation.sql
git commit -m "Campus isolation: current_campus() + storage-path campus helpers"
```

---

## Task 3: Rewrite table SELECT policies

Each policy below currently ends its permissive chain with a bare
`public.current_role() = 'Super Admin'`. Replace **only that clause** with
`(public.current_role() = 'Super Admin' and <campus expr> = public.current_campus())`.
Recreate the whole policy with `drop policy if exists … ; create policy …` so the
change is explicit and re-runnable. Keep every other branch (self / teammate /
assigned-SPOC) byte-for-byte as it is in the migration named in the table.

**Files:**
- Modify: `supabase/migrations/0025_campus_isolation.sql` (append)

**Interfaces:**
- Consumes: `current_campus()` (Task 2); `teams.campus`, `profiles.campus`, `rooms.campus`, `zones.campus` (Task 1).
- Produces: campus-scoped SELECT policies on the 16 tables listed.

| Policy (source migration) | `<campus expr>` |
|---|---|
| `profiles.profiles_select` (0001) | `profiles.campus` |
| `teams.teams_select` (0001) | `teams.campus` |
| `team_members.team_members_select` (0001) | `(select t.campus from public.teams t where t.id = team_members.team_id)` |
| `problem_statement_selections.ps_selections_select` (0001) | `(select t.campus from public.teams t where t.id = problem_statement_selections.team_id)` |
| `problem_statement_extensions.ps_extensions_select` (0001) | `(select t.campus from public.teams t where t.id = problem_statement_extensions.team_id)` |
| `attendance.attendance_select` (0001) | `(select t.campus from public.teams t where t.id = attendance.team_id)` |
| `attendance_audit_log.attendance_audit_select` (0001) | `(select t.campus from public.attendance a join public.teams t on t.id = a.team_id where a.id = attendance_audit_log.attendance_id)` |
| `food_coupons.food_coupons_select` (0001) | `(select t.campus from public.team_members tm join public.teams t on t.id = tm.team_id where tm.profile_id = food_coupons.profile_id)` |
| `nocs.nocs_select` (0001) | `(select t.campus from public.team_members tm join public.teams t on t.id = tm.team_id where tm.profile_id = nocs.profile_id)` |
| `noc_audit_log.noc_audit_select` (0001) | `(select t.campus from public.nocs n join public.team_members tm on tm.profile_id = n.profile_id join public.teams t on t.id = tm.team_id where n.id = noc_audit_log.noc_id)` |
| `exit_forms.exit_forms_select` (0001) | `(select t.campus from public.teams t where t.id = exit_forms.team_id)` |
| `approval_requests.approval_requests_select` (0001) | `(select t.campus from public.teams t where t.id = approval_requests.team_id)` |
| `audit_logs.audit_logs_select` (0001) | `(select p.campus from public.profiles p where p.id = audit_logs.actor_profile_id)` |
| `presentations.presentations_select` (0009) | `(select t.campus from public.teams t where t.id = presentations.team_id)` |
| `exit_requests.exit_requests_select` (0012) | `(select t.campus from public.teams t where t.id = exit_requests.team_id)` |

**`zones` and `rooms`** currently use `using (true)` (from 0006). Replace with a
real predicate — everyone still needs to resolve names within their own campus:

```sql
drop policy if exists zones_select on public.zones;
create policy zones_select on public.zones for select to authenticated
using (campus = public.current_campus());

drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms for select to authenticated
using (campus = public.current_campus());
```

**Do NOT touch:** `problem_statements_select`, `attendance_sessions_select`,
`configuration_select`, `notifications_select` (Spec D2 / recipient-keyed).

- [ ] **Step 1: For each of the 15 table policies, append a `drop policy if exists` + full `create policy` block** — copy the existing policy body from its source migration, and AND the campus expression into the Super-Admin clause only. Example for `teams_select` (source 0001 lines 284-289):

```sql
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams for select to authenticated
using (
  id = public.current_team_id()
  or spoc_profile_id = public.current_profile_id()
  or (public.current_role() = 'Super Admin' and campus = public.current_campus())
);
```

Example for `nocs_select` (source 0001 lines 366-379) — note the Super-Admin
clause is the last `or`:

```sql
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
```

- [ ] **Step 2: Append the `zones`/`rooms` blocks above.**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0025_campus_isolation.sql
git commit -m "Campus isolation: scope every Super-Admin SELECT policy branch to current_campus()"
```

---

## Task 4: Rewrite storage-object SELECT/UPDATE/DELETE policies

**Files:**
- Modify: `supabase/migrations/0025_campus_isolation.sql` (append)

**Interfaces:**
- Consumes: `is_same_campus_profile(uuid)`, `is_same_campus_team(uuid)` (Task 2).
- Produces: campus-scoped storage policies on the `noc-uploads`, `exit-forms`, `ppt-uploads` buckets.

The storage policies (0002 for NOC, 0012 for exit-forms, 0009 for PPT) grant the
Super Admin access with a bare `public.current_role() = 'Super Admin'`. For every
such clause, AND in the matching campus helper. The first path segment
`(storage.foldername(name))[1]::uuid` is a **profile id** in the `noc-uploads`
bucket and a **team id** in `exit-forms` and `ppt-uploads`.

- [ ] **Step 1: Recreate each affected storage policy** with `drop policy if exists <name> on storage.objects;` then the original `create policy` body from its source migration, with the Super-Admin clause changed:

- `noc-uploads` bucket — policies `noc_uploads_select`, `noc_uploads_update`, `noc_uploads_delete` (source 0002; `noc_uploads_insert` has no Super-Admin branch — leave it):
  `or public.current_role() = 'Super Admin'`  →
  `or (public.current_role() = 'Super Admin' and public.is_same_campus_profile((storage.foldername(name))[1]::uuid))`
- `exit-forms` bucket — policies `exit_forms_select_storage`, `exit_forms_update_storage`, `exit_forms_delete_storage` (source 0012):
  `or public.current_role() = 'Super Admin'`  →
  `or (public.current_role() = 'Super Admin' and public.is_same_campus_team((storage.foldername(name))[1]::uuid))`
- `ppt-uploads` bucket — policies `ppt_uploads_select`, `ppt_uploads_update`, `ppt_uploads_delete` (source 0009):
  same change as `exit-forms` (`is_same_campus_team`).

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0025_campus_isolation.sql
git commit -m "Campus isolation: scope NOC/exit-form/PPT storage policies to current_campus()"
```

---

## Task 5: Campus-setting RPCs — `register_team`, `create_staff_profile`, `create_room`, `create_zone`

**Files:**
- Modify: `supabase/migrations/0025_campus_isolation.sql` (append)

**Interfaces:**
- Consumes: `next_user_id(text)` (0001), `current_campus()` (Task 2), `teams.campus` / `rooms.campus` / `zones.campus` (Task 1).
- Produces: `register_team` now reads `p_payload->'team'->>'campus'` and stamps it on the team and every profile; `create_staff_profile` stamps `current_campus()`; `create_room` / `create_zone` stamp `current_campus()`.

- [ ] **Step 1: Append the new `register_team`** — this is the 0006 body with a `v_campus` local added. Replace the two `'VSP'` literals and add the `teams.campus` insert:

```sql
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
```

- [ ] **Step 2: Append the new `create_staff_profile`** — the 0004 body with `'VSP'` replaced by `public.current_campus()`:

```sql
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
```

- [ ] **Step 3: Append the new `create_room` and `create_zone`** — the 0006 bodies with `campus` added to the insert:

```sql
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
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0025_campus_isolation.sql
git commit -m "Campus isolation: register_team takes campus; staff/room/zone inherit current_campus()"
```

---

## Task 6: Cross-campus guards on assignment + admin-mutation RPCs

**Files:**
- Modify: `supabase/migrations/0025_campus_isolation.sql` (append)

**Interfaces:**
- Consumes: `current_campus()` (Task 2); `campus` columns (Task 1).
- Produces: `create or replace` of each RPC below with a `CROSS_CAMPUS` guard added. Every other line of each body is copied verbatim from its source migration.

### 6a — Assignment RPCs (source 0006)

Add the guard immediately after the existing `if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;` line.

| RPC | Guard to insert |
|---|---|
| `assign_spoc_to_room(p_room_id, p_spoc_profile_id)` | ```sql if p_spoc_profile_id is not null and (select campus from public.profiles where id = p_spoc_profile_id) is distinct from (select campus from public.rooms where id = p_room_id) then raise exception 'CROSS_CAMPUS'; end if;``` |
| `assign_team_to_room(p_team_id, p_room_id)` | ```sql if p_room_id is not null and (select campus from public.teams where id = p_team_id) is distinct from (select campus from public.rooms where id = p_room_id) then raise exception 'CROSS_CAMPUS'; end if;``` (place before the existing `if p_room_id is null` short-circuit) |
| `assign_room_to_zone(p_room_id, p_zone_id)` | ```sql if p_zone_id is not null and (select campus from public.rooms where id = p_room_id) is distinct from (select campus from public.zones where id = p_zone_id) then raise exception 'CROSS_CAMPUS'; end if;``` |
| `assign_zone_manager(p_zone_id, p_manager_profile_id)` | ```sql if p_manager_profile_id is not null and (select campus from public.profiles where id = p_manager_profile_id) is distinct from (select campus from public.zones where id = p_zone_id) then raise exception 'CROSS_CAMPUS'; end if;``` |

Also in `assign_spoc` (0003, team↔SPOC direct assignment — still present): add
```sql
if (select campus from public.profiles where id = p_spoc_profile_id) is distinct from (select campus from public.teams where id = p_team_id) then raise exception 'CROSS_CAMPUS'; end if;
```
after its authorization check.

### 6b — Admin-only mutation RPCs

For each RPC, after its existing authorization check (`is_assigned_spoc_of_team(...) or current_role() = 'Super Admin'`, or the `current_role() <> 'Super Admin'` variant), insert a guard that the **target row's campus** equals `public.current_campus()`. Use the target-identifying argument from this table:

| RPC (source) | Target campus lookup |
|---|---|
| `delete_team(p_team_id)` (0006) | `(select campus from public.teams where id = p_team_id)` |
| `delete_member(p_profile_id)` (0006) | `(select campus from public.profiles where id = p_profile_id)` |
| `delete_spoc(p_profile_id)` (0006) | `(select campus from public.profiles where id = p_profile_id)` |
| `delete_noc(p_profile_id)` (0003) | `(select campus from public.profiles where id = p_profile_id)` |
| `delete_presentation(p_team_id)` (0009) | `(select campus from public.teams where id = p_team_id)` |
| `delete_exit_request(p_profile_id)` (0012) | `(select campus from public.profiles where id = p_profile_id)` |
| `update_member(...)` (0007 — first arg is the target profile id) | `(select campus from public.profiles where id = <that arg>)` |
| `update_team_name(p_team_id, ...)` (0003) | `(select campus from public.teams where id = p_team_id)` |
| `update_user_role(p_profile_id, p_new_role)` (0003) | `(select campus from public.profiles where id = p_profile_id)` — **plus**: reject if `p_new_role = 'Super Admin'` and that campus `<> current_campus()` (already covered by the same guard, keep it single) |
| `change_team_lead(p_team_id, p_new_lead_profile_id)` (0022) | `(select campus from public.teams where id = p_team_id)` |
| `admin_set_problem_statement(p_team_id, ...)` (0023) | `(select campus from public.teams where id = p_team_id)` |
| `record_attendance(p_session_id, p_profile_id, p_status)` (0003) | `(select campus from public.profiles where id = p_profile_id)` |
| `record_food_redemption(p_profile_id, ...)` (0003) | `(select campus from public.profiles where id = p_profile_id)` |
| `resolve_approval_request(p_request_id, ...)` (0003) | `(select t.campus from public.approval_requests ar join public.teams t on t.id = ar.team_id where ar.id = p_request_id)` |
| `resolve_member_exit(p_request_id, ...)` (0012) | `(select t.campus from public.exit_requests er join public.teams t on t.id = er.team_id where er.id = p_request_id)` |
| `extend_noc_deadline(p_profile_id, ...)` (0015) | `(select campus from public.profiles where id = p_profile_id)` |
| `extend_presentation_deadline(p_team_id, ...)` (0009/0019) | `(select campus from public.teams where id = p_team_id)` |
| `extend_problem_statement_deadline(p_team_id, ...)` (0003) | `(select campus from public.teams where id = p_team_id)` |

Guard shape (adjust the lookup per row):

```sql
if <target campus lookup> is distinct from public.current_campus() then
  raise exception 'CROSS_CAMPUS';
end if;
```

### 6c — Mixed-caller RPCs (Team Lead **or** admin)

`record_noc_metadata(p_profile_id, ...)` (0003), `record_presentation(p_team_id, ...)` (0009),
`record_exit_form(p_team_id, ...)` (0001/0003). These already branch on
"is the caller the owner/lead OR an admin". Add the `CROSS_CAMPUS` guard **only
inside the admin branch** (where the code has established the caller is Super
Admin / assigned SPOC, not the team lead). Do not add it to the team-lead path.

- [ ] **Step 1:** Append `create or replace` for every RPC in 6a, 6b, 6c — full body copied from the source migration, with the one guard inserted. Keep each function's trailing `revoke` / `grant` lines identical to the source.
- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0025_campus_isolation.sql
git commit -m "Campus isolation: CROSS_CAMPUS guards on assignment + admin-mutation RPCs"
```

---

## Task 7: Notification scoping + campus Super Admin seeds

**Files:**
- Modify: `supabase/migrations/0025_campus_isolation.sql` (append)

**Interfaces:**
- Consumes: `next_user_id(text)` (0001), `public.campus` enum (Task 1).
- Produces: registration + broadcast notifications limited to the relevant campus's staff; `public.seed_campus_super_admin(p_campus, p_email)`; three seeded Super Admin profile rows.

- [ ] **Step 1: Scope the "new team registration" admin notification.** Find where new-registration notifications are inserted for staff (search the migrations for `New Team Registration` / the notify block in `register_team` or a trigger). Wherever the recipient set is `select id from public.profiles where role in ('Super Admin','SPOC')`, add `and campus = <new team campus>`. If `register_team` itself does not currently send this (it may be a separate trigger/RPC), add the campus filter there. Append the `create or replace` for whichever function/trigger owns that insert.

- [ ] **Step 2: Scope `broadcast_notification`.** Append `create or replace function public.broadcast_notification(p_title text, p_message text, p_audience text)` — the latest body (0017) with every recipient-selecting query gaining `and campus = public.current_campus()`. Keep the audience-branching logic otherwise identical.

- [ ] **Step 3: Append the seed helper + calls.**

```sql
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
```

> **Executor:** stop and ask the product owner for the three real email addresses. Put them in the migration before it is applied. Leaving `REPLACE_*` in will create Super Admins that can never log in (no Google account matches).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0025_campus_isolation.sql
git commit -m "Campus isolation: per-campus notification scoping + campus Super Admin seeds"
```

---

## Task 8: App layer — registration campus field + types + admin dashboard filter

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/lib/registration/schema.ts`
- Modify: `src/components/registration/RegistrationStepper.tsx`
- Modify: `src/components/registration/steps/TeamDetailsStep.tsx`
- Modify: `src/components/registration/steps/ReviewStep.tsx`
- Modify: `src/lib/dashboard/admin-data.ts`
- Modify: `src/components/dashboard/admin/sections/TeamsByTeamView.tsx`
- Modify: `src/components/dashboard/admin/sections/TeamDetailModal.tsx`
- Modify: `src/components/dashboard/admin/sections/StaffAccountsSection.tsx`

**Interfaces:**
- Consumes: `register_team` now expecting `p_payload.team.campus` (Task 5); `profiles.campus` / `teams.campus` present in query results (Task 1).
- Produces: `CampusCode` type; `CAMPUS_OPTIONS`; `campus` in the registration form + payload; `fetchAdminDashboardData` filtered to the caller's campus for Super Admins too.

- [ ] **Step 1: `src/types/database.ts`** — add the type and fields:

```ts
export type CampusCode = "VSP" | "BLR" | "HYD";
```
Change `ProfileRow.campus: string;` → `campus: CampusCode;`. Add `campus: CampusCode;` to `TeamRow`, `RoomRow`, `ZoneRow`.

- [ ] **Step 2: `src/lib/registration/schema.ts`** — add options + schema field:

```ts
export const CAMPUS_OPTIONS = [
  { code: "VSP", label: "Visakhapatnam" },
  { code: "BLR", label: "Bangalore" },
  { code: "HYD", label: "Hyderabad" },
] as const;

export type CampusCode = (typeof CAMPUS_OPTIONS)[number]["code"];
```
In `teamDetailsSchema`, add:
```ts
  campus: z.enum(["VSP", "BLR", "HYD"], { error: "Select a campus" }),
```

- [ ] **Step 3: `RegistrationStepper.tsx`** — give the field a default so the select is controlled, and validate it at step 1:
  - In `defaultValues.team`, change `{ teamName: "", memberCount: MIN_TEAM_SIZE }` to `{ teamName: "", campus: "VSP", memberCount: MIN_TEAM_SIZE }`.
  - In `goNext`, step 1 branch: `valid = await trigger(["team.campus", "team.teamName", "team.memberCount"]);`

- [ ] **Step 4: `TeamDetailsStep.tsx`** — add the campus select as the **first** `FormField`, above Team Name. Import `CAMPUS_OPTIONS`:

```tsx
import { CAMPUS_OPTIONS, MAX_TEAM_SIZE, MIN_TEAM_SIZE, type RegistrationFormValues } from "@/lib/registration/schema";
```
```tsx
<FormField label="Campus" required error={errors.team?.campus?.message} htmlFor="team-campus">
  <select
    id="team-campus"
    aria-invalid={!!errors.team?.campus}
    className={fieldInputClass}
    {...register("team.campus")}
  >
    {CAMPUS_OPTIONS.map((c) => (
      <option key={c.code} value={c.code}>{c.label}</option>
    ))}
  </select>
</FormField>
```

- [ ] **Step 5: `ReviewStep.tsx`** — show campus. Import `CAMPUS_OPTIONS`, and add a row in the Team card:

```tsx
<ReviewRow
  label="Campus"
  value={CAMPUS_OPTIONS.find((c) => c.code === values.team.campus)?.label ?? values.team.campus}
/>
```

- [ ] **Step 6: `src/lib/dashboard/admin-data.ts`** — campus-narrow for Super Admins.
  - Extract the existing cascade (lines ~126-136) into a local function:

```ts
function narrowToTeamIds(teamIds: Set<string>) {
  const sMembersByTeam = Object.fromEntries(
    Object.entries(membersByTeam).filter(([teamId]) => teamIds.has(teamId)),
  );
  const memberIds = new Set(Object.values(sMembersByTeam).flatMap((m) => m.map((x) => x.id)));
  return {
    teams: scopedTeams.filter((t) => teamIds.has(t.id)),
    membersByTeam: sMembersByTeam,
    pendingApprovals: scopedPendingApprovals.filter((a) => teamIds.has(a.team_id)),
    attendance: scopedAttendance.filter((a) => teamIds.has(a.team_id)),
    exitRequests: scopedExitRequests.filter((e) => teamIds.has(e.team_id)),
    presentations: scopedPresentations.filter((p) => teamIds.has(p.team_id)),
    nocs: scopedNocs.filter((n) => memberIds.has(n.profile_id)),
    psExtensions: scopedPsExtensions.filter((e) => teamIds.has(e.team_id)),
  };
}
```
  - Replace the `if (profile.role !== "Super Admin")` block with:

```ts
if (profile.role === "Super Admin") {
  scopedTeams = scopedTeams.filter((t) => t.campus === profile.campus);
} else {
  scopedTeams = scopedTeams.filter((t) => t.spoc_profile_id === profile.id);
}
{
  const teamIds = new Set(scopedTeams.map((t) => t.id));
  const n = narrowToTeamIds(teamIds);
  scopedTeams = n.teams;
  scopedMembersByTeam = n.membersByTeam;
  scopedPendingApprovals = n.pendingApprovals;
  scopedAttendance = n.attendance;
  scopedNocs = n.nocs;
  scopedExitRequests = n.exitRequests;
  scopedPresentations = n.presentations;
  scopedPsExtensions = n.psExtensions;
}
```
  - Filter the standalone lists in the returned object by campus for Super Admins (and harmlessly for SPOCs, whose rows are already single-campus). Change the four `select("*")` results in the return to campus-filtered:

```ts
const inCampus = <T extends { campus?: string }>(rows: T[]) =>
  rows.filter((r) => r.campus === profile.campus);
```
and use it for `spocs`, `staffAccounts`, `rooms`, `zones`. For `notifications`, filter to rows whose `recipient_profile_id` is the caller's own id (already the case) — no campus change needed there.

  > Note: the doc-comment at the top of the function still says the extra filter is "No-op for Super Admin" — update that sentence to describe the campus narrowing.

- [ ] **Step 7: Campus badges (read-only).**
  - `TeamsByTeamView.tsx`: add a "Campus" column/cell rendering `team.campus`.
  - `TeamDetailModal.tsx`: add a `campus` line in the team basic-details block.
  - `StaffAccountsSection.tsx`: add a "Campus" column rendering `account.campus`.
  Match each file's existing table/detail markup and class names; no new components.

- [ ] **Step 8: Commit**

```bash
git add src/types/database.ts src/lib/registration src/components/registration src/lib/dashboard/admin-data.ts src/components/dashboard/admin/sections
git commit -m "Campus isolation: registration campus field, CampusCode types, campus-scoped admin dashboard data"
```

---

## Task 9: Verification (single pass, at the end)

**Files:**
- Create: `supabase/tests/campus_isolation.sql`
- Modify: `supabase/audit_check.sql`

- [ ] **Step 1: `next build` and `lint`.**

```bash
npm run lint
npm run build
```
Expected: both clean. Fix any type errors from the `CampusCode` narrowing (likely spots: anywhere `ProfileRow.campus` was assumed to be an arbitrary `string`).

- [ ] **Step 2: Extend `supabase/audit_check.sql`.** Add to the relevant `expected_*` CTEs:
  - `expected_enums`: `('campus')`
  - `expected_functions`: `('current_campus', 0), ('is_same_campus_team', 1), ('is_same_campus_profile', 1), ('seed_campus_super_admin', 2)`
  - a new `drift_checks` row per isolated policy asserting its `qual` now contains `current_campus`, e.g.:

```sql
  union all
  select 'drift check', 'teams_select is campus-scoped',
    case when qual ilike '%current_campus%' then 'OK' else 'NOT CAMPUS-SCOPED' end, qual
  from pg_policies where schemaname='public' and tablename='teams' and policyname='teams_select'
```
  (repeat for `profiles_select`, `team_members_select`, `nocs_select`, `attendance_select`, `approval_requests_select`, `presentations_select`, `exit_requests_select`, `rooms_select`, `zones_select`).
  - a column check: `teams`, `rooms`, `zones` each have a `campus` column of type `campus`.
  - a counter check: `campus_counters` has 3 rows (`VSP`, `BLR`, `HYD`).

- [ ] **Step 3: Create `supabase/tests/campus_isolation.sql`.** Read-only; pasted into the SQL Editor after the migration is applied. It:
  1. Prints `current_campus()` for each of the 3 seeded Super Admins (via `set local role authenticated` + `set local request.jwt.claims` to each `auth_user_id` — or, simpler, a direct `select gitam_email, campus, role from profiles where role = 'Super Admin'` and eyeball that there is exactly one per campus).
  2. For a chosen campus (e.g. VSP), asserts these all return 0:
     `select count(*) from teams where campus <> 'VSP'` seen through the VSP admin — documented as a manual `set role` check with the JWT claim block, since the SQL Editor runs as `postgres`/service and bypasses RLS.
  3. Documents the manual dashboard checklist (below) as a comment block.

```sql
-- supabase/tests/campus_isolation.sql — run AFTER 0025 is applied.
-- The SQL Editor bypasses RLS, so true isolation is verified by logging in as
-- each campus Super Admin in the app. This script only sanity-checks the seed
-- data and that the campus columns/counters exist.

select 'seeded super admins' as check,
       campus, count(*) as n
from public.profiles where role = 'Super Admin' group by campus order by campus;
-- expect: one row each for BLR, HYD, VSP (n = 1)

select 'campus counters' as check, campus_code, next_user_seq
from public.campus_counters order by campus_code;
-- expect: BLR>=1000, HYD>=1000, VSP>=1000

select 'teams without campus' as check, count(*) as n
from public.teams where campus is null;   -- expect 0

select 'profiles without campus' as check, count(*) as n
from public.profiles where campus is null; -- expect 0
```

- [ ] **Step 4: Manual verification checklist** (record results in the PR description):
  - Register a team choosing **Bangalore** → completion screen shows `BLR1000`, `BLR1001`, … ; `teams.campus = 'BLR'`.
  - Register a team choosing **Hyderabad** → `HYD1000`, … .
  - Log in as the VSP Super Admin → Teams / Members / Attendance / NOC / PPT / Approvals / Rooms / Staff Accounts pages show **only** VSP rows; BLR/HYD teams are absent.
  - As VSP Super Admin, create a SPOC → new SPOC row has `campus = 'VSP'`; it does not appear for the BLR admin.
  - As VSP Super Admin, attempt to assign a VSP SPOC to a BLR room (via whatever UI path exists, or a direct RPC call) → `CROSS_CAMPUS` error.
  - Problem statements / attendance sessions / configuration → identical for all three admins (global, per Spec D2).

- [ ] **Step 5: Commit**

```bash
git add supabase/tests/campus_isolation.sql supabase/audit_check.sql
git commit -m "Campus isolation: audit-check additions + isolation verification script"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- §4.1 enum/columns/counters → Task 1 ✓
- §4.2 `current_campus()` + storage helpers → Task 2 ✓
- §4.3 table SELECT policies (16) → Task 3 ✓
- §4.4 storage policies → Task 4 ✓
- §4.5 campus-setting RPCs → Task 5 ✓ ; assignment guards + admin-mutation guards + mixed-caller → Task 6 ✓
- §4.6 notifications → Task 7 ✓
- §4.7 app layer (schema, form, admin-data, types, badges) → Task 8 ✓
- §4.8 bootstrap/seed → Task 7 (seed fn + calls) + Task 1 (backfill via `default 'VSP'` + counter update) ✓
- §6 testing → Task 9 ✓
- D6 VSP-counter-reset guard → Task 1 Step 1 (the `not exists` clause) ✓

**Placeholder scan:** The only intentional placeholders are `REPLACE_VSP_ADMIN_EMAIL` / `BLR` / `HYD` in Task 7 — flagged with a stop-and-ask note, per Spec D3 (emails come from the product owner). No other TBD/TODO.

**Type consistency:** `CampusCode` is declared in both `src/types/database.ts` and (structurally) `src/lib/registration/schema.ts` from `CAMPUS_OPTIONS`; both resolve to the same `"VSP" | "BLR" | "HYD"` union. `current_campus()` returns `public.campus`; helpers return `boolean`; guard exception string is `CROSS_CAMPUS` everywhere. `narrowToTeamIds` keys match the `scoped*` locals already in `admin-data.ts`.

**Gaps:** Task 7 Step 1 depends on locating the current new-registration notification insert (its exact home isn't pinned in the migrations skim). The executor must grep for it; if no such insert exists yet, that step is a no-op and should be recorded as such.
