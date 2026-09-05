-- delete_member (0012) cleans up rows *about* the deleted member (their own
-- NOC, attendance, exit request, ...) but never rows where the member acted
-- *on someone else's* record — exactly what a Team Lead routinely does
-- (uploading a teammate's NOC, uploading the team's presentation). Those
-- leave a dangling uploaded_by/performed_by pointing at the deleted
-- profile, which Postgres correctly refuses with a foreign-key violation.
-- This surfaced now because deleting a demoted former Team Lead is the
-- first realistic way to hit it — a plain Member rarely acts on anyone
-- else's records. noc_audit_log.performed_by is NOT NULL with no cascade,
-- so those rows must be deleted rather than nulled.

create or replace function public.delete_member(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
  if exists (select 1 from public.team_members where profile_id = p_profile_id and is_lead) then
    raise exception 'CANNOT_DELETE_LEAD';
  end if;

  update public.audit_logs set actor_profile_id = null where actor_profile_id = p_profile_id;
  delete from public.approval_requests where requested_by = p_profile_id;
  delete from public.problem_statement_selections where selected_by = p_profile_id;
  delete from public.exit_requests where profile_id = p_profile_id;

  -- Rows this profile acted on for someone else (e.g. as Team Lead) —
  -- these aren't "about" this profile so the profile_id-keyed deletes
  -- below never touch them.
  delete from public.noc_audit_log where performed_by = p_profile_id;
  update public.nocs set uploaded_by = null where uploaded_by = p_profile_id;
  update public.presentations set uploaded_by = null where uploaded_by = p_profile_id;

  delete from public.attendance where profile_id = p_profile_id;
  delete from public.food_coupons where profile_id = p_profile_id;
  delete from public.nocs where profile_id = p_profile_id;
  -- Cascades team_members (profile_id ON DELETE CASCADE).
  delete from public.profiles where id = p_profile_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'Member Deleted', 'profile', p_profile_id);
end;
$$;
revoke all on function public.delete_member(uuid) from public, anon;
grant execute on function public.delete_member(uuid) to authenticated;
