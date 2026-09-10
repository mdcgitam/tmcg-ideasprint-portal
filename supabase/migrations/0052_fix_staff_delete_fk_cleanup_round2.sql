-- 0052_fix_staff_delete_fk_cleanup_round2.sql
-- 0051 covered every "who did this" actor column it could find at the time,
-- but deleting a SPOC/Zone Manager/Campus Admin with real history is still
-- coming back 23503 (foreign_key_violation) after 0051 was applied. A fresh
-- audit of every column that `references public.profiles(id)` turned up two
-- more that clear_profile_actor_refs never touched:
--
--   - problem_statement_selections.selected_by (NOT NULL) — set by
--     admin_set_problem_statement (0023), callable by an assigned SPOC
--     (is_assigned_spoc_of_team folds in Zone Manager, per 0047) or Super
--     Admin correcting a team's PS.
--   - teams.spoc_profile_id / rooms.spoc_profile_id / zones.zone_manager_profile_id
--     were only nulled inline inside delete_spoc/delete_zone_manager
--     themselves (0051), never for delete_campus_admin, and not
--     unconditionally for the other two either — a test account that was
--     ever reassigned between roles during earlier testing can leave a
--     stale reference under any of these columns regardless of its current
--     role. Centralizing them in the shared helper covers that regardless
--     of which delete_* path runs.

alter table public.problem_statement_selections alter column selected_by drop not null;

create or replace function public.clear_profile_actor_refs(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.audit_logs set actor_profile_id = null where actor_profile_id = p_profile_id;
  update public.configuration set updated_by = null where updated_by = p_profile_id;
  update public.attendance set recorded_by = null where recorded_by = p_profile_id;
  update public.attendance_audit_log set modified_by = null where modified_by = p_profile_id;
  update public.nocs set uploaded_by = null where uploaded_by = p_profile_id;
  update public.noc_audit_log set performed_by = null where performed_by = p_profile_id;
  update public.presentations set uploaded_by = null where uploaded_by = p_profile_id;
  update public.approval_requests set reviewed_by = null where reviewed_by = p_profile_id;
  update public.exit_requests set reviewed_by = null where reviewed_by = p_profile_id;
  update public.id_card_certificate_records set recorded_by = null where recorded_by = p_profile_id;
  update public.problem_statement_extensions set granted_by = null where granted_by = p_profile_id;
  update public.exit_forms set uploaded_by = null where uploaded_by = p_profile_id;
  update public.problem_statement_selections set selected_by = null where selected_by = p_profile_id;
  update public.teams set team_lead_profile_id = null where team_lead_profile_id = p_profile_id;
  update public.teams set spoc_profile_id = null, updated_at = now() where spoc_profile_id = p_profile_id;
  update public.rooms set spoc_profile_id = null, updated_at = now() where spoc_profile_id = p_profile_id;
  update public.zones set zone_manager_profile_id = null, updated_at = now() where zone_manager_profile_id = p_profile_id;
end;
$$;
revoke all on function public.clear_profile_actor_refs(uuid) from public, anon, authenticated;

-- delete_spoc/delete_zone_manager/delete_campus_admin already call
-- clear_profile_actor_refs before their own now-redundant inline
-- teams/rooms/zones nulling — no need to redefine them, the shared helper
-- above is what they call and is now comprehensive.
