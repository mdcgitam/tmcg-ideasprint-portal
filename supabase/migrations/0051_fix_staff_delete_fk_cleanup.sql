-- 0051_fix_staff_delete_fk_cleanup.sql
-- Deleting a SPOC/Zone Manager/Campus Admin fails with a bare foreign-key
-- violation (surfaced to the UI as "Something went wrong") whenever that
-- account has ever performed a logged action — recorded attendance,
-- uploaded a NOC/PPT on a team's behalf, resolved an exit request, edited
-- Configuration, extended a deadline, marked an ID card/certificate, or
-- anything else that stamps `actor_profile_id`/`recorded_by`/`uploaded_by`/
-- etc. with their profile id. A brand-new account with no history deletes
-- fine — exactly the "some work, some don't" symptom reported.
--
-- delete_member (0024/0032/0039) already does this cleanup for a
-- participant being removed, but it was never carried over to
-- delete_spoc, delete_zone_manager, or delete_campus_admin, and it never
-- covered several columns this audit found: attendance.recorded_by,
-- attendance_audit_log.modified_by, configuration.updated_by,
-- approval_requests.reviewed_by, exit_requests.reviewed_by,
-- id_card_certificate_records.recorded_by, problem_statement_extensions.granted_by.
--
-- Five of those "who did this" columns were declared NOT NULL, so they
-- can't just be nulled out without a schema change first — done below.
-- (nocs.uploaded_by, presentations.uploaded_by, audit_logs.actor_profile_id,
-- configuration.updated_by, approval_requests/exit_requests.reviewed_by were
-- already nullable.)

alter table public.attendance alter column recorded_by drop not null;
alter table public.attendance_audit_log alter column modified_by drop not null;
alter table public.noc_audit_log alter column performed_by drop not null;
alter table public.id_card_certificate_records alter column recorded_by drop not null;
alter table public.problem_statement_extensions alter column granted_by drop not null;

-- Shared cleanup: null out every "who did this" reference to p_profile_id
-- across the tables a staff account (SPOC/Zone Manager/Campus Admin) could
-- have touched, preserving the underlying record/history and only
-- anonymizing who performed it. Not granted to `authenticated` — called
-- internally from the SECURITY DEFINER delete_* functions below only.
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
end;
$$;
revoke all on function public.clear_profile_actor_refs(uuid) from public, anon, authenticated;

-- ── delete_spoc ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_spoc(p_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then raise exception 'NOT_ALLOWED'; end if;
  if not public.is_platform_admin() and ((select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile_id and role = 'SPOC') then
    raise exception 'NOT_A_SPOC';
  end if;

  perform public.clear_profile_actor_refs(p_profile_id);

  update public.rooms set spoc_profile_id = null, updated_at = now() where spoc_profile_id = p_profile_id;
  update public.teams set spoc_profile_id = null, updated_at = now() where spoc_profile_id = p_profile_id;
  update public.zones set zone_manager_profile_id = null, updated_at = now() where zone_manager_profile_id = p_profile_id;
  delete from public.profiles where id = p_profile_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'SPOC Deleted', 'profile', p_profile_id);
end;
$function$;
revoke all on function public.delete_spoc(uuid) from public, anon;
grant execute on function public.delete_spoc(uuid) to authenticated;

-- ── delete_zone_manager ──────────────────────────────────────────────────
create or replace function public.delete_zone_manager(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then raise exception 'NOT_ALLOWED'; end if;
  if not public.is_platform_admin()
     and ((select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile_id and role = 'Zone Manager') then
    raise exception 'NOT_A_ZONE_MANAGER';
  end if;

  perform public.clear_profile_actor_refs(p_profile_id);

  update public.zones set zone_manager_profile_id = null, updated_at = now() where zone_manager_profile_id = p_profile_id;
  delete from public.profiles where id = p_profile_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'Zone Manager Deleted', 'profile', p_profile_id);
end;
$$;
revoke all on function public.delete_zone_manager(uuid) from public, anon;
grant execute on function public.delete_zone_manager(uuid) to authenticated;

-- ── delete_campus_admin ──────────────────────────────────────────────────
create or replace function public.delete_campus_admin(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'NOT_ALLOWED'; end if;
  if not exists (select 1 from public.profiles where id = p_profile_id and role = 'Campus Admin') then
    raise exception 'NOT_A_CAMPUS_ADMIN';
  end if;

  perform public.clear_profile_actor_refs(p_profile_id);

  delete from public.profiles where id = p_profile_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'Campus Admin Deleted', 'profile', p_profile_id);
end;
$$;
revoke all on function public.delete_campus_admin(uuid) from public, anon;
grant execute on function public.delete_campus_admin(uuid) to authenticated;
