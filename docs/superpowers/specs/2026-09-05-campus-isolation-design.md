# Campus Isolation — Design Spec

**Date:** 2026-09-05
**Status:** Approved for planning
**Topic:** Make the portal a three-campus system (Visakhapatnam / Bangalore / Hyderabad) with hard data isolation between campuses.

---

## 1. Problem

Today the portal is single-campus. `profiles.campus` exists as `text default 'VSP'`,
`campus_counters` + `next_user_id(p_campus)` already support per-campus User ID
sequences, but nothing else is campus-aware:

- `register_team` and `create_staff_profile` hardcode `'VSP'`.
- Only the `VSP` counter row is seeded.
- No RLS policy, RPC, or app-layer query filters by campus. A Super Admin sees
  every team on the platform; there is no notion of a "VSP Super Admin".
- The registration form never asks which campus a team belongs to.

We need the same deployment to run all three Phase-1 campuses side by side with
**no data bleed** between them.

## 2. Goals

1. Registration collects a **Campus** (Visakhapatnam / Bangalore / Hyderabad),
   chosen once, for the whole team.
2. User IDs are campus-prefixed and independently auto-incrementing:
   `VSP1000…`, `BLR1000…`, `HYD1000…`.
3. Every role (Super Admin, SPOC, Team Lead, Member) sees and acts on **only
   their own campus's** teams, members, attendance, NOCs, PPTs, approvals,
   problem-statement selections, rooms, zones, and notifications.
4. Creating a SPOC (or any staff account) stamps it with the creating Super
   Admin's campus. No cross-campus staff.
5. Rooms and zones inherit the creating Super Admin's campus automatically —
   no campus picker in their UI.

## 3. Decisions (locked)

| # | Decision |
|---|---|
| D1 | **All Super Admins are campus-bound.** There is no global/root Super Admin and no campus switcher. Each campus has its own Super Admin(s). |
| D2 | **Config tables stay global:** `problem_statements`, `attendance_sessions`, `configuration`. Only people/teams/records are isolated. A Super Admin of any campus editing these affects all campuses (accepted). |
| D3 | **Campus Super Admins are seeded** via a migration; the three email addresses are provided by the product owner at implementation time. |
| D4 | **Global uniqueness retained:** `gitam_email`, `phone`, `reg_no` remain UNIQUE platform-wide. The same person cannot register in two campuses. |
| D5 | **Campus is chosen once**, at team registration. Everywhere else it is derived from the actor (`current_campus()`) or the parent row. |
| D6 | **VSP counter resets to 1000** so VSP also starts at `VSP1000`. Safe only because no VSP participants have been issued IDs yet — implementation must verify `select max(user_id) from profiles where campus='VSP'` shows no issued sequence before applying. If VSP IDs already exist, leave the counter and flag to the owner. |
| D7 | **UI shows full city names** (Visakhapatnam / Bangalore / Hyderabad); the DB stores the 3-letter code (VSP / BLR / HYD). |

## 4. Architecture

### 4.1 New campus dimension

**Enum**

```sql
create type public.campus as enum ('VSP', 'BLR', 'HYD');
```

**Columns**

| Table | Column | Notes |
|---|---|---|
| `profiles` | `campus` | Convert existing `text` → `public.campus`. `USING campus::public.campus` (all rows are `'VSP'`). Keep `not null default 'VSP'`. |
| `teams` | `campus` | **New.** `public.campus not null default 'VSP'`. Backfill existing rows to `'VSP'`, then keep the default (harmless; `register_team` always sets it explicitly). Add `teams_campus_idx`. |
| `rooms` | `campus` | **New.** `public.campus not null default 'VSP'`. Backfill to `'VSP'`. Set by `create_room` from `current_campus()`. |
| `zones` | `campus` | **New.** Same as `rooms`. |

**Counters**

```sql
update public.campus_counters set next_user_seq = 1000 where campus_code = 'VSP';  -- D6, guarded
insert into public.campus_counters (campus_code, next_user_seq)
values ('BLR', 1000), ('HYD', 1000)
on conflict (campus_code) do nothing;
```

`next_user_id(p_campus)` already returns `p_campus || seq` and raises on an
unknown code — no change needed, it just starts receiving `'BLR'` / `'HYD'`.

### 4.2 `current_campus()` helper

```sql
create or replace function public.current_campus()
returns public.campus
language sql stable security definer set search_path = public as $$
  select campus from public.profiles where auth_user_id = auth.uid();
$$;
```

Mirrors the existing `current_role()` / `current_profile_id()` pattern in
`0001_init_schema.sql` (SECURITY DEFINER + fixed `search_path`, so calling it
from a policy on `profiles` does not recurse).

Two more SECURITY DEFINER helpers for the storage policies (§4.4), which cannot
JOIN:

```sql
create or replace function public.is_same_campus_team(p_team_id uuid) returns boolean … 
  -- select exists(select 1 from teams where id = p_team_id and campus = current_campus())
create or replace function public.is_same_campus_profile(p_profile_id uuid) returns boolean …
  -- select exists(select 1 from profiles where id = p_profile_id and campus = current_campus())
```

### 4.3 RLS — read isolation

For every table below, the **"Super Admin sees everything" branch** of the
existing SELECT policy changes from

```sql
or public.current_role() = 'Super Admin'
```

to

```sql
or (public.current_role() = 'Super Admin' and <campus expr> = public.current_campus())
```

where `<campus expr>` is:

| Table | `<campus expr>` |
|---|---|
| `profiles` | `profiles.campus` |
| `teams` | `teams.campus` |
| `team_members` | `(select campus from teams where id = team_members.team_id)` |
| `problem_statement_selections` | via `teams` |
| `problem_statement_extensions` | via `teams` |
| `attendance` | via `teams` |
| `attendance_audit_log` | via `attendance → teams` |
| `food_coupons` | via `team_members → teams` |
| `nocs` | via `team_members → teams` |
| `noc_audit_log` | via `nocs → team_members → teams` |
| `exit_forms` / `exit_requests` | via `teams` |
| `approval_requests` | via `teams` |
| `presentations` (0009) | via `teams` |
| `audit_logs` | via `actor_profile_id → profiles.campus` |
| `zones` | `zones.campus` — replaces the current blanket `using (true)` |
| `rooms` | `rooms.campus` — replaces `using (true)` |

**SPOC branches** (`is_assigned_spoc_of_team`, `spoc_profile_id = current_profile_id()`)
need no change: once `rooms.campus` exists and `assign_spoc_to_room` forbids
cross-campus assignment (§4.5), a SPOC can only ever be assigned rooms/teams in
their own campus, so those branches are already campus-safe.

**Left unchanged (global, per D2):**
`problem_statements_select`, `attendance_sessions_select`, `configuration_select`,
`notifications_select` (recipient-keyed — campus is enforced at insert time by
choosing recipients, §4.6).

### 4.4 Storage RLS (`0002_team_dashboard.sql`, NOC + exit-form buckets)

The object policies gate Super Admin access with a bare
`public.current_role() = 'Super Admin'`. Each such clause becomes:

```sql
or (public.current_role() = 'Super Admin'
    and public.is_same_campus_profile((storage.foldername(name))[1]::uuid))   -- NOC bucket
-- …or is_same_campus_team(...) for the exit-form bucket
```

### 4.5 RPC — write isolation

**Campus-setting RPCs:**

| RPC | Change |
|---|---|
| `register_team(p_payload)` | Read `v_campus := p_payload->'team'->>'campus'`; reject if not in `('VSP','BLR','HYD')`; `next_user_id(v_campus)`; write `teams.campus = v_campus` and every `profiles.campus = v_campus`. |
| `create_staff_profile(name,email,role)` | Replace hardcoded `'VSP'` with `public.current_campus()` for both `next_user_id(...)` and the `profiles.campus` insert. |
| `create_room(name, zone_id)` | Insert `campus = public.current_campus()`. |
| `create_zone(name, manager_profile_id)` | Insert `campus = public.current_campus()`. |

**Cross-campus assignment guards (raise `CROSS_CAMPUS`):**

| RPC | Guard |
|---|---|
| `assign_spoc_to_room(room_id, spoc_profile_id)` | SPOC's `campus` must equal the room's `campus`. |
| `assign_team_to_room(team_id, room_id)` | team's `campus` must equal the room's `campus`. |
| `assign_room_to_zone(room_id, zone_id)` | room's `campus` must equal the zone's `campus`. |
| `assign_zone_manager(zone_id, manager_profile_id)` | manager's `campus` must equal the zone's `campus`. |

**"Same-campus target" guard on every admin mutation.** Each RPC below already
checks `is_assigned_spoc_of_team(...) or current_role() = 'Super Admin'` (or
`current_role() <> 'Super Admin' → NOT_ALLOWED`). Add, after that check, a guard
that raises `CROSS_CAMPUS` **when the caller is acting as an admin** (Super Admin
or SPOC) **and** the target row's campus ≠ `current_campus()`. For RPCs that also
have a self/team-lead caller path (`record_noc_metadata`, `record_presentation`,
`record_exit_form`), the guard is skipped on that path — a Team Lead is always in
their own team's campus by construction, so only the admin path needs it.

Admin-only RPCs (guard always applies):

```
delete_team, delete_member, delete_spoc, delete_noc, delete_presentation,
delete_exit_request, update_member, update_team_name, update_user_role,
change_team_lead, admin_set_problem_statement, record_attendance,
record_food_redemption, resolve_approval_request, resolve_member_exit,
extend_noc_deadline, extend_presentation_deadline,
extend_problem_statement_deadline
```

Mixed-caller RPCs (guard on the admin branch only):

```
record_noc_metadata, record_presentation, record_exit_form
```

`update_user_role` additionally must not allow promoting a profile from another
campus, and must not create a Super Admin outside `current_campus()`.

Global-config RPCs unchanged (still Super-Admin-only, campus-agnostic per D2):
`set_configuration`, `upsert_problem_statement`, `create_attendance_session`.

### 4.6 Notifications

- **New team registration** (`register_team` / its notify path): insert
  notification rows only for `profiles` where `role in ('Super Admin','SPOC')
  and campus = <new team's campus>`.
- **`broadcast_notification(title, message, audience)`**: restrict the resolved
  recipient set to `campus = current_campus()` (a VSP Super Admin's "broadcast
  to all" reaches only VSP).
- Per-team/per-participant notifications already target a specific
  `recipient_profile_id` and need no change.

### 4.7 App layer

**Registration**

- `src/lib/registration/schema.ts`:
  ```ts
  export const CAMPUS_OPTIONS = [
    { code: "VSP", label: "Visakhapatnam" },
    { code: "BLR", label: "Bangalore" },
    { code: "HYD", label: "Hyderabad" },
  ] as const;
  ```
  Add `campus: z.enum(["VSP", "BLR", "HYD"], { error: "Select a campus" })` to
  `teamDetailsSchema`. Extend `TeamDetailsFormValues` default in the form.
- `src/components/registration/steps/TeamDetailsStep.tsx`: add the Campus
  `<select>` as the **first** field (before Team Name).
- `src/components/registration/steps/ReviewStep.tsx`: show the chosen campus.
- `src/lib/registration/actions.ts`: `submitRegistration` already spreads
  `input.team` into the payload — campus flows through automatically once it's
  on the schema. No signature change.

**Admin/SPOC data**

- `src/lib/dashboard/admin-data.ts` → `fetchAdminDashboardData(profile)`:
  the block currently gated by `if (profile.role !== "Super Admin")` narrows
  every team-keyed collection to `spoc_profile_id === profile.id`. Generalise:
  - **Super Admin:** narrow `teams` to `t.campus === profile.campus`, then
    cascade to `membersByTeam`, `attendance`, `nocs`, `exitRequests`,
    `presentations`, `pendingApprovals`, `problemStatementExtensions` by the
    surviving team-id set (same cascade already written for the SPOC case).
  - Also filter `spocs`, `staffAccounts`, `rooms`, `zones`, `notifications` by
    `campus === profile.campus`.
  - **SPOC:** unchanged logic, but it now runs *in addition to* nothing — SPOC
    rows are already single-campus.
  - Factor the shared "cascade by team-id set" into one local helper so the
    Super-Admin and SPOC paths don't duplicate it.
- `computeDashboardCardCounts` needs no change (operates on already-scoped data).

**Types** — `src/types/database.ts`: add `campus: CampusCode` to `TeamRow`,
`RoomRow`, `ZoneRow`; add `export type CampusCode = "VSP" | "BLR" | "HYD"`;
`ProfileRow.campus` narrows from `string` to `CampusCode`.

**Display** — add a Campus column/badge to the admin Teams table
(`TeamsByTeamView` / `TeamDetailModal`) and Staff Accounts table
(`StaffAccountsSection`). Read-only everywhere.

**Unchanged** — login, `auth/callback`, `dashboardPathForRole`, session
handling. Campus rides along on the profile row that `getCurrentProfile()`
already returns.

### 4.8 Bootstrap migration

```sql
-- backfill (all no-ops on current data except the inserts)
update public.profiles set campus = 'VSP' where campus is null;
-- teams/rooms/zones get campus via `add column … default 'VSP' not null`

-- counters
update public.campus_counters set next_user_seq = 1000
  where campus_code = 'VSP' and not exists (            -- D6 guard
    select 1 from public.profiles where campus = 'VSP' and user_id ~ '^VSP[0-9]+$');
insert into public.campus_counters (campus_code, next_user_seq)
  values ('BLR', 1000), ('HYD', 1000) on conflict do nothing;

-- seed campus Super Admins — emails filled in at implementation time
select public.seed_campus_super_admin('VSP', '<vsp-admin-email>');
select public.seed_campus_super_admin('BLR', '<blr-admin-email>');
select public.seed_campus_super_admin('HYD', '<hyd-admin-email>');
```

`seed_campus_super_admin(p_campus, p_email)` — a one-shot SECURITY DEFINER
helper (no `current_role()` check; only ever called from the migration and then
dropped, or left revoked from all roles): inserts a `profiles` row with
`role = 'Super Admin'`, `campus = p_campus`, `user_id = next_user_id(p_campus)`,
`name = 'Super Admin (<campus>)'`, `auth_user_id = null` (linked on first
Google login by email match, same as participants).

## 5. Isolation model — summary table

| Actor | Sees | Can mutate |
|---|---|---|
| Super Admin (VSP) | All VSP teams, members, records, rooms, zones, staff, notifications. Global problem statements / sessions / config. | Any VSP row. Global config (shared). Cannot touch BLR/HYD rows — RLS hides them, RPC guards raise `CROSS_CAMPUS`. |
| SPOC (VSP) | Their assigned VSP rooms' teams only. | Assigned teams' attendance / food / NOC / approvals. |
| Team Lead / Member | Their own team only (already campus-consistent). | Per existing role matrix. |

## 6. Testing

No test runner exists (`package.json` has `dev` / `build` / `start` / `lint`
only). Verification:

1. **`supabase/tests/campus_isolation.sql`** — a new pgTAP-style / plain-SQL
   script: seed one team per campus, then `set local role` + `request.jwt.claims`
   to a VSP Super Admin and assert `select count(*)` is 0 for every isolated
   table when filtered to BLR/HYD rows; assert `current_campus()` returns `'VSP'`.
2. **Manual** — register a team under each campus, confirm IDs are
   `VSP1000` / `BLR1000` / `HYD1000`; log in as each campus Super Admin and
   confirm the dashboard shows only that campus; attempt an `assign_spoc_to_room`
   across campuses and confirm `CROSS_CAMPUS`.
3. **`npm run build`** and **`npm run lint`** clean.

## 7. Out of scope

- Global/root Super Admin, campus switcher (D1).
- Per-campus problem statements, sessions, or event config (D2).
- Per-campus homepage content.
- Migrating any existing non-VSP data (there is none).

## 8. Migration / file inventory

| File | Action |
|---|---|
| `supabase/migrations/0025_campus_isolation.sql` | **New.** Enum, columns, counters, `current_campus()` + campus helpers, all SELECT-policy rewrites, storage-policy rewrites, all RPC rewrites, notification scoping, `seed_campus_super_admin`, backfill, seeds. |
| `supabase/tests/campus_isolation.sql` | **New.** Isolation assertions. |
| `src/lib/registration/schema.ts` | `CAMPUS_OPTIONS`, `campus` on `teamDetailsSchema`. |
| `src/components/registration/steps/TeamDetailsStep.tsx` | Campus select (first field). |
| `src/components/registration/steps/ReviewStep.tsx` | Show campus. |
| `src/lib/dashboard/admin-data.ts` | Campus narrowing for Super Admin; shared cascade helper. |
| `src/types/database.ts` | `CampusCode`; `campus` on `TeamRow` / `RoomRow` / `ZoneRow`. |
| `src/components/dashboard/admin/sections/TeamsByTeamView.tsx`, `TeamDetailModal.tsx`, `StaffAccountsSection.tsx` | Campus badge/column (read-only). |

One migration, kept internally ordered: types → columns → helpers → policies →
RPCs → data. RPC bodies are `create or replace` (same pattern as `0006`).
