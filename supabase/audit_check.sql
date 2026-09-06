-- ============================================================================
-- TMCG IdeaSprint 4.0 — Supabase schema audit
--
-- Read-only. Paste this whole file into the Supabase SQL Editor and run it.
-- It checks every enum, table, function/RPC, RLS policy, storage bucket, and
-- storage policy that 0001-0004 in supabase/migrations/ are supposed to have
-- created, against what's actually live in this project. It also spot-checks
-- a few things that were corrected via an ALTER POLICY / CREATE OR REPLACE
-- snippet mid-conversation rather than a numbered migration file, since those
-- are the easiest kind of fix to lose track of.
--
-- Read the `status` column: anything other than 'OK' needs attention. Rows
-- are sorted so problems float to the top.
-- ============================================================================

with expected_enums(name) as (
  values ('user_role'),('team_status'),('ps_status'),('attendance_status'),
         ('noc_status'),('exit_status'),('approval_status'),
         ('campus')
),
enum_check as (
  select 'enum'::text as category, e.name,
    case when t.typname is null then 'MISSING' else 'OK' end as status,
    null::text as detail
  from expected_enums e
  left join pg_type t on t.typname = e.name and t.typnamespace = 'public'::regnamespace
),

expected_tables(name) as (
  values ('campus_counters'),('profiles'),('teams'),('team_members'),
         ('problem_statements'),('problem_statement_selections'),
         ('problem_statement_extensions'),('attendance_sessions'),
         ('attendance'),('attendance_audit_log'),
         ('nocs'),('noc_audit_log'),('exit_forms'),('notifications'),
         ('approval_requests'),('audit_logs'),('configuration')
),
table_check as (
  select 'table'::text as category, e.name,
    case when c.relname is null then 'MISSING'
         when not c.relrowsecurity then 'RLS DISABLED'
         else 'OK' end as status,
    null::text as detail
  from expected_tables e
  left join pg_class c on c.relname = e.name and c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
),

-- Matched by name + arg count, not the full identity-argument string —
-- Postgres's canonical type spelling (e.g. "timestamp with time zone" for
-- timestamptz) is easy to get subtly wrong by hand, so the actual signature
-- is surfaced in `detail` for a quick visual check instead of risking a
-- false MISSING from a formatting mismatch.
expected_functions(name, expected_arg_count) as (
  values
    ('current_profile_id', 0), ('current_role', 0), ('current_team_id', 0),
    ('is_own_or_led_profile', 1), ('is_led_profile', 1),
    ('is_own_team', 1), ('is_led_team', 1),
    ('is_assigned_spoc_of_profile', 1), ('is_assigned_spoc_of_team', 1),
    ('next_user_id', 1), ('next_team_id', 0),
    ('register_team', 1),
    ('check_team_name_available', 1),
    ('check_participant_available', 2),
    ('submit_team_edit_request', 3),
    ('select_problem_statement', 2),
    ('record_noc_metadata', 2),
    ('delete_noc', 1),
    ('record_exit_form', 2),
    ('mark_notification_read', 1),
    ('resolve_approval_request', 2),
    ('create_attendance_session', 4),
    ('record_attendance', 3),
    ('extend_problem_statement_deadline', 3),
    ('upsert_problem_statement', 5),
    ('assign_spoc', 2),
    ('update_user_role', 2),
    ('set_configuration', 3),
    ('create_campus_admin', 3),
    ('create_spoc', 3),
    ('is_platform_admin', 0),
    ('current_campus', 0),
    ('is_same_campus_team', 1),
    ('is_same_campus_profile', 1),
    ('seed_campus_super_admin', 2)
),
function_check as (
  select 'function'::text as category,
    e.name || '/' || e.expected_arg_count::text as name,
    case when p.proname is null then 'MISSING'
         when p.pronargs <> e.expected_arg_count then 'ARG COUNT MISMATCH'
         else 'OK' end as status,
    pg_get_function_identity_arguments(p.oid) as detail
  from expected_functions e
  left join pg_proc p on p.proname = e.name and p.pronamespace = 'public'::regnamespace
),

expected_policies(tbl, pol) as (
  values
    ('profiles','profiles_select'), ('teams','teams_select'),
    ('team_members','team_members_select'), ('problem_statements','problem_statements_select'),
    ('problem_statement_selections','ps_selections_select'),
    ('problem_statement_extensions','ps_extensions_select'),
    ('attendance_sessions','attendance_sessions_select'), ('attendance','attendance_select'),
    ('attendance_audit_log','attendance_audit_select'),
    ('exit_forms','exit_forms_select'), ('approval_requests','approval_requests_select'),
    ('nocs','nocs_select'), ('noc_audit_log','noc_audit_select'),
    ('notifications','notifications_select'), ('audit_logs','audit_logs_select'),
    ('configuration','configuration_select')
),
policy_check as (
  select 'rls policy'::text as category, e.tbl || '.' || e.pol as name,
    case when pp.policyname is null then 'MISSING' else 'OK' end as status,
    null::text as detail
  from expected_policies e
  left join pg_policies pp on pp.schemaname = 'public' and pp.tablename = e.tbl and pp.policyname = e.pol
),

expected_buckets(name) as (
  values ('noc-uploads'), ('exit-forms')
),
bucket_check as (
  select 'storage bucket'::text as category, e.name,
    case when b.id is null then 'MISSING'
         when b.public then 'SHOULD BE PRIVATE'
         else 'OK' end as status,
    null::text as detail
  from expected_buckets e
  left join storage.buckets b on b.id = e.name
),

expected_storage_policies(pol) as (
  values ('noc_uploads_select'),('noc_uploads_insert'),('noc_uploads_update'),('noc_uploads_delete'),
         ('exit_forms_select_storage'),('exit_forms_insert_storage'),('exit_forms_update_storage'),('exit_forms_delete_storage')
),
storage_policy_check as (
  select 'storage policy'::text as category, e.pol as name,
    case when pp.policyname is null then 'MISSING' else 'OK' end as status,
    null::text as detail
  from expected_storage_policies e
  left join pg_policies pp on pp.schemaname = 'storage' and pp.tablename = 'objects' and pp.policyname = e.pol
),

-- Things that were fixed via an ad-hoc ALTER POLICY / CREATE OR REPLACE
-- snippet handed over mid-conversation, not a new numbered migration file —
-- these are the ones most likely to have been missed, since there's no
-- "0005_xxx.sql" to point at and confirm was run.
drift_checks as (
  select 'drift check'::text as category, 'noc_uploads_update allows the assigned SPOC' as name,
    case when qual ilike '%is_assigned_spoc_of_profile%' then 'OK' else 'STALE / NARROW' end as status,
    qual as detail
  from pg_policies where schemaname='storage' and tablename='objects' and policyname='noc_uploads_update'
  union all
  select 'drift check', 'noc_uploads_delete allows the assigned SPOC',
    case when qual ilike '%is_assigned_spoc_of_profile%' then 'OK' else 'STALE / NARROW' end,
    qual
  from pg_policies where schemaname='storage' and tablename='objects' and policyname='noc_uploads_delete'
  union all
  select 'drift check', 'delete_noc() RPC allows the assigned SPOC',
    case when pg_get_functiondef(p.oid) ilike '%is_assigned_spoc_of_profile%' then 'OK' else 'STALE (pre-0003 version)' end,
    null
  from pg_proc p where p.proname = 'delete_noc' and p.pronamespace = 'public'::regnamespace
  union all
  select 'drift check', 'select_problem_statement() honours per-team deadline extensions',
    case when pg_get_functiondef(p.oid) ilike '%v_extended_until%' then 'OK' else 'STALE (pre-0003 version)' end,
    null
  from pg_proc p where p.proname = 'select_problem_statement' and p.pronamespace = 'public'::regnamespace
  union all
  select 'drift check', 'profiles participant columns are nullable (0004)',
    case when bool_and(is_nullable = 'YES') then 'OK' else 'NOT APPLIED' end,
    string_agg(column_name || '=' || is_nullable, ', ' order by column_name)
  from information_schema.columns
  where table_schema='public' and table_name='profiles'
    and column_name in ('reg_no','phone','year_of_study','school','department','branch','gender','stay')
  union all
  select 'drift check', 'teams_select is campus-scoped (0025)',
    case when qual ilike '%current_campus%' then 'OK' else 'NOT CAMPUS-SCOPED' end,
    qual
  from pg_policies where schemaname='public' and tablename='teams' and policyname='teams_select'
  union all
  select 'drift check', 'profiles_select is campus-scoped (0025)',
    case when qual ilike '%current_campus%' then 'OK' else 'NOT CAMPUS-SCOPED' end,
    qual
  from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select'
  union all
  select 'drift check', 'team_members_select is campus-scoped (0025)',
    case when qual ilike '%current_campus%' then 'OK' else 'NOT CAMPUS-SCOPED' end,
    qual
  from pg_policies where schemaname='public' and tablename='team_members' and policyname='team_members_select'
  union all
  select 'drift check', 'nocs_select is campus-scoped (0025)',
    case when qual ilike '%current_campus%' then 'OK' else 'NOT CAMPUS-SCOPED' end,
    qual
  from pg_policies where schemaname='public' and tablename='nocs' and policyname='nocs_select'
  union all
  select 'drift check', 'attendance_select is campus-scoped (0025)',
    case when qual ilike '%current_campus%' then 'OK' else 'NOT CAMPUS-SCOPED' end,
    qual
  from pg_policies where schemaname='public' and tablename='attendance' and policyname='attendance_select'
  union all
  select 'drift check', 'approval_requests_select is campus-scoped (0025)',
    case when qual ilike '%current_campus%' then 'OK' else 'NOT CAMPUS-SCOPED' end,
    qual
  from pg_policies where schemaname='public' and tablename='approval_requests' and policyname='approval_requests_select'
  union all
  select 'drift check', 'presentations_select is campus-scoped (0025)',
    case when qual ilike '%current_campus%' then 'OK' else 'NOT CAMPUS-SCOPED' end,
    qual
  from pg_policies where schemaname='public' and tablename='presentations' and policyname='presentations_select'
  union all
  select 'drift check', 'exit_requests_select is campus-scoped (0025)',
    case when qual ilike '%current_campus%' then 'OK' else 'NOT CAMPUS-SCOPED' end,
    qual
  from pg_policies where schemaname='public' and tablename='exit_requests' and policyname='exit_requests_select'
  union all
  select 'drift check', 'rooms_select is campus-scoped (0025)',
    case when qual ilike '%current_campus%' then 'OK' else 'NOT CAMPUS-SCOPED' end,
    qual
  from pg_policies where schemaname='public' and tablename='rooms' and policyname='rooms_select'
  union all
  select 'drift check', 'zones_select is campus-scoped (0025)',
    case when qual ilike '%current_campus%' then 'OK' else 'NOT CAMPUS-SCOPED' end,
    qual
  from pg_policies where schemaname='public' and tablename='zones' and policyname='zones_select'
  union all
  select 'drift check', 'teams/rooms/zones each have a campus column of type campus (0025)',
    case when count(*) filter (where udt_name = 'campus') = 3 then 'OK' else 'MISSING / WRONG TYPE' end,
    string_agg(table_name || '.' || column_name || '=' || udt_name, ', ' order by table_name)
  from information_schema.columns
  where table_schema='public' and table_name in ('teams','rooms','zones') and column_name='campus'
  union all
  select 'drift check', 'campus_counters has 3 rows (VSP, BLR, HYD) (0025)',
    case when (select count(*) from public.campus_counters) = 3 then 'OK' else 'WRONG ROW COUNT' end,
    (select string_agg(campus_code, ', ' order by campus_code) from public.campus_counters)
),

grant_checks as (
  select 'grant check'::text as category, 'register_team() is service_role-only' as name,
    case when not exists (
      select 1 from information_schema.role_routine_grants
      where routine_schema='public' and routine_name='register_team'
        and grantee in ('PUBLIC','anon','authenticated')
    ) then 'OK' else 'OVER-GRANTED' end as status,
    null::text as detail
  union all
  select 'grant check', 'approval_requests_one_pending_per_team unique index exists',
    case when exists (
      select 1 from pg_indexes where schemaname='public' and indexname='approval_requests_one_pending_per_team'
    ) then 'OK' else 'MISSING' end,
    null
)

select * from (
  select * from enum_check
  union all select * from table_check
  union all select * from function_check
  union all select * from policy_check
  union all select * from bucket_check
  union all select * from storage_policy_check
  union all select * from drift_checks
  union all select * from grant_checks
) results
order by (status <> 'OK') desc, category, name;
