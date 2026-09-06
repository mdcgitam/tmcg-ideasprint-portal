-- 0036_zone_manager_access.sql
-- Give a Zone Manager the same read + action surface a SPOC has, but across
-- every team in every venue of the zone(s) they manage
-- (zones.zone_manager_profile_id -> rooms.zone_id -> teams.room_id).
--
-- Two new predicates identify "a team / participant in a zone I manage".
-- They are folded into is_assigned_spoc_of_team / is_assigned_spoc_of_profile
-- (every storage.objects policy and every SPOC-gated RPC already calls one of
-- those), and added as an explicit OR to the table SELECT policies that
-- inline the SPOC check (spoc_profile_id = current_profile_id()) instead of
-- calling the helper.
--
-- Applied statement-by-statement (simple protocol), same as prior migrations.

-- ── New predicates ───────────────────────────────────────────────────────
create or replace function public.is_zone_manager_of_team(p_team_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.teams t
    join public.rooms r on r.id = t.room_id
    join public.zones z on z.id = r.zone_id
    where t.id = p_team_id
      and z.zone_manager_profile_id = public.current_profile_id()
  );
$$;
revoke all on function public.is_zone_manager_of_team(uuid) from public, anon;
grant execute on function public.is_zone_manager_of_team(uuid) to authenticated;

create or replace function public.is_zone_manager_of_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.team_members tm
    join public.teams t on t.id = tm.team_id
    join public.rooms r on r.id = t.room_id
    join public.zones z on z.id = r.zone_id
    where tm.profile_id = p_profile_id
      and z.zone_manager_profile_id = public.current_profile_id()
  );
$$;
revoke all on function public.is_zone_manager_of_profile(uuid) from public, anon;
grant execute on function public.is_zone_manager_of_profile(uuid) to authenticated;

-- ── Fold the Zone Manager into the shared SPOC predicates ─────────────────
-- Name kept for call-site stability; these now read as "the assigned SPOC OR
-- the managing Zone Manager". Every use is an access grant (OR'd into a
-- policy / RPC guard), so widening is safe. This alone covers every
-- storage.objects policy and every SPOC-gated RPC (resolve_approval_request,
-- record_attendance, record_noc, delete_noc, record_presentation,
-- resolve_member_exit, admin_set_problem_statement, ...).
create or replace function public.is_assigned_spoc_of_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.profile_id = p_profile_id and t.spoc_profile_id = public.current_profile_id()
  ) or public.is_zone_manager_of_profile(p_profile_id);
$$;

create or replace function public.is_assigned_spoc_of_team(p_team_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.teams where id = p_team_id and spoc_profile_id = public.current_profile_id())
      or public.is_zone_manager_of_team(p_team_id);
$$;

-- ── Table SELECT policies that inline the SPOC check ──────────────────────
-- Each keeps its existing clauses; a Zone Manager OR term is added beside the
-- SPOC clause. Shape: using ( ( <clauses> ) OR public.is_platform_admin() ).

drop policy if exists approval_requests_select on public.approval_requests;
create policy approval_requests_select on public.approval_requests as permissive for SELECT to authenticated
using (
  (
    (team_id = current_team_id())
    OR (team_id IN (SELECT teams.id FROM teams WHERE teams.spoc_profile_id = current_profile_id()))
    OR public.is_zone_manager_of_team(approval_requests.team_id)
    OR (("current_role"() = 'Campus Admin'::user_role) AND ((SELECT t.campus FROM teams t WHERE t.id = approval_requests.team_id) = current_campus()))
  )
  OR public.is_platform_admin()
);

drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance as permissive for SELECT to authenticated
using (
  (
    (team_id = current_team_id())
    OR (team_id IN (SELECT teams.id FROM teams WHERE teams.spoc_profile_id = current_profile_id()))
    OR public.is_zone_manager_of_team(attendance.team_id)
    OR (("current_role"() = 'Campus Admin'::user_role) AND ((SELECT t.campus FROM teams t WHERE t.id = attendance.team_id) = current_campus()))
  )
  OR public.is_platform_admin()
);

drop policy if exists attendance_audit_select on public.attendance_audit_log;
create policy attendance_audit_select on public.attendance_audit_log as permissive for SELECT to authenticated
using (
  (
    (("current_role"() = 'Campus Admin'::user_role) AND ((SELECT t.campus FROM (attendance a JOIN teams t ON t.id = a.team_id) WHERE a.id = attendance_audit_log.attendance_id) = current_campus()))
    OR (EXISTS (SELECT 1 FROM (attendance a JOIN teams t ON t.id = a.team_id) WHERE a.id = attendance_audit_log.attendance_id AND t.spoc_profile_id = current_profile_id()))
    OR public.is_zone_manager_of_team((SELECT a.team_id FROM attendance a WHERE a.id = attendance_audit_log.attendance_id))
  )
  OR public.is_platform_admin()
);

drop policy if exists exit_forms_select on public.exit_forms;
create policy exit_forms_select on public.exit_forms as permissive for SELECT to authenticated
using (
  (
    (team_id = current_team_id())
    OR (team_id IN (SELECT teams.id FROM teams WHERE teams.spoc_profile_id = current_profile_id()))
    OR public.is_zone_manager_of_team(exit_forms.team_id)
    OR (("current_role"() = 'Campus Admin'::user_role) AND ((SELECT t.campus FROM teams t WHERE t.id = exit_forms.team_id) = current_campus()))
  )
  OR public.is_platform_admin()
);

drop policy if exists noc_audit_select on public.noc_audit_log;
create policy noc_audit_select on public.noc_audit_log as permissive for SELECT to authenticated
using (
  (
    (("current_role"() = 'Campus Admin'::user_role) AND ((SELECT t.campus FROM ((nocs n JOIN team_members tm ON tm.profile_id = n.profile_id) JOIN teams t ON t.id = tm.team_id) WHERE n.id = noc_audit_log.noc_id) = current_campus()))
    OR (EXISTS (SELECT 1 FROM ((nocs n JOIN team_members tm ON tm.profile_id = n.profile_id) JOIN teams t ON t.id = tm.team_id) WHERE n.id = noc_audit_log.noc_id AND ((("current_role"() = 'Team Lead'::user_role) AND tm.team_id = current_team_id()) OR t.spoc_profile_id = current_profile_id())))
    OR public.is_zone_manager_of_profile((SELECT n.profile_id FROM nocs n WHERE n.id = noc_audit_log.noc_id))
  )
  OR public.is_platform_admin()
);

drop policy if exists nocs_select on public.nocs;
create policy nocs_select on public.nocs as permissive for SELECT to authenticated
using (
  (
    (profile_id = current_profile_id())
    OR (("current_role"() = 'Team Lead'::user_role) AND (profile_id IN (SELECT team_members.profile_id FROM team_members WHERE team_members.team_id = current_team_id())))
    OR (profile_id IN (SELECT tm.profile_id FROM (team_members tm JOIN teams t ON t.id = tm.team_id) WHERE t.spoc_profile_id = current_profile_id()))
    OR public.is_zone_manager_of_profile(nocs.profile_id)
    OR (("current_role"() = 'Campus Admin'::user_role) AND ((SELECT t.campus FROM (team_members tm JOIN teams t ON t.id = tm.team_id) WHERE tm.profile_id = nocs.profile_id) = current_campus()))
  )
  OR public.is_platform_admin()
);

drop policy if exists presentations_select on public.presentations;
create policy presentations_select on public.presentations as permissive for SELECT to authenticated
using (
  (
    (team_id = current_team_id())
    OR (team_id IN (SELECT teams.id FROM teams WHERE teams.spoc_profile_id = current_profile_id()))
    OR public.is_zone_manager_of_team(presentations.team_id)
    OR (("current_role"() = 'Campus Admin'::user_role) AND ((SELECT t.campus FROM teams t WHERE t.id = presentations.team_id) = current_campus()))
  )
  OR public.is_platform_admin()
);

drop policy if exists ps_extensions_select on public.problem_statement_extensions;
create policy ps_extensions_select on public.problem_statement_extensions as permissive for SELECT to authenticated
using (
  (
    (team_id = current_team_id())
    OR (team_id IN (SELECT teams.id FROM teams WHERE teams.spoc_profile_id = current_profile_id()))
    OR public.is_zone_manager_of_team(problem_statement_extensions.team_id)
    OR (("current_role"() = 'Campus Admin'::user_role) AND ((SELECT t.campus FROM teams t WHERE t.id = problem_statement_extensions.team_id) = current_campus()))
  )
  OR public.is_platform_admin()
);

drop policy if exists ps_selections_select on public.problem_statement_selections;
create policy ps_selections_select on public.problem_statement_selections as permissive for SELECT to authenticated
using (
  (
    (team_id = current_team_id())
    OR (team_id IN (SELECT teams.id FROM teams WHERE teams.spoc_profile_id = current_profile_id()))
    OR public.is_zone_manager_of_team(problem_statement_selections.team_id)
    OR (("current_role"() = 'Campus Admin'::user_role) AND ((SELECT t.campus FROM teams t WHERE t.id = problem_statement_selections.team_id) = current_campus()))
  )
  OR public.is_platform_admin()
);

drop policy if exists problem_statements_select on public.problem_statements;
create policy problem_statements_select on public.problem_statements as permissive for SELECT to authenticated
using (
  (
    (status = 'Released'::ps_status)
    OR ("current_role"() = ANY (ARRAY['SPOC'::user_role, 'Zone Manager'::user_role, 'Campus Admin'::user_role]))
  )
  OR public.is_platform_admin()
);

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles as permissive for SELECT to authenticated
using (
  (
    (auth_user_id = auth.uid())
    OR (id IN (SELECT team_members.profile_id FROM team_members WHERE team_members.team_id = current_team_id()))
    OR (id IN (SELECT tm.profile_id FROM (team_members tm JOIN teams t ON t.id = tm.team_id) WHERE t.spoc_profile_id = current_profile_id()))
    OR public.is_zone_manager_of_profile(profiles.id)
    OR (("current_role"() = 'Campus Admin'::user_role) AND (campus = current_campus()))
  )
  OR public.is_platform_admin()
);

drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members as permissive for SELECT to authenticated
using (
  (
    (team_id = current_team_id())
    OR (team_id IN (SELECT teams.id FROM teams WHERE teams.spoc_profile_id = current_profile_id()))
    OR public.is_zone_manager_of_team(team_members.team_id)
    OR (("current_role"() = 'Campus Admin'::user_role) AND ((SELECT t.campus FROM teams t WHERE t.id = team_members.team_id) = current_campus()))
  )
  OR public.is_platform_admin()
);

-- teams_select: an inline rooms/zones lookup (not is_zone_manager_of_team,
-- which reads teams) so this policy never re-enters itself.
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams as permissive for SELECT to authenticated
using (
  (
    (id = current_team_id())
    OR (spoc_profile_id = current_profile_id())
    OR (room_id IN (SELECT r.id FROM (rooms r JOIN zones z ON z.id = r.zone_id) WHERE z.zone_manager_profile_id = current_profile_id()))
    OR (("current_role"() = 'Campus Admin'::user_role) AND (campus = current_campus()))
  )
  OR public.is_platform_admin()
);
