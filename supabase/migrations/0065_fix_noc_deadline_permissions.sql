-- 0065_fix_noc_deadline_permissions.sql
-- 0064 recreated extend_noc_deadline and delete_noc by copying the old
-- pre-0031 permission checks (SPOC/Super Admin only, and a cross-campus
-- check that never exempted platform admins). That regressed the 0031 fix:
--   - Campus Admin lost the ability to call either function at all
--     (NOT_ALLOWED), since it was never in the allowed-role list.
--   - Super Admin's own profile has campus = null, so current_campus()
--     returns null for them; "target_campus IS DISTINCT FROM NULL" is true
--     for any team member, so every Super Admin call hit CROSS_CAMPUS.
-- This is exactly the "Something went wrong" on the NOC page's per-row and
-- bulk Extend actions. Restoring the 0031 checks (Campus Admin allowed,
-- is_platform_admin() bypasses the cross-campus check) while keeping 0064's
-- deadline_updated_at tracking and effective_noc_deadline gating.

create or replace function public.extend_noc_deadline(p_profile_id uuid, p_deadline timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (
    public.is_assigned_spoc_of_profile(p_profile_id)
    or public.current_role() = 'Campus Admin' or public.is_platform_admin()
  ) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.is_platform_admin() and ((select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  insert into public.nocs (profile_id, deadline, deadline_updated_at) values (p_profile_id, p_deadline, now())
  on conflict (profile_id) do update set deadline = excluded.deadline, deadline_updated_at = now(), updated_at = now();
end;
$$;
revoke all on function public.extend_noc_deadline(uuid, timestamptz) from public, anon;
grant execute on function public.extend_noc_deadline(uuid, timestamptz) to authenticated;

create or replace function public.delete_noc(p_profile_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_noc_id uuid;
  v_deadline timestamptz;
begin
  if not (
    public.is_own_or_led_profile(p_profile_id)
    or public.is_assigned_spoc_of_profile(p_profile_id)
    or public.current_role() = 'Campus Admin' or public.is_platform_admin()
  ) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.is_platform_admin() and ((select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  v_deadline := public.effective_noc_deadline(p_profile_id);
  if v_deadline is not null and now() > v_deadline and not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'DEADLINE_PASSED';
  end if;

  update public.nocs set status = 'Not Uploaded', file_path = null, updated_at = now()
  where profile_id = p_profile_id
  returning id into v_noc_id;

  if v_noc_id is not null then
    insert into public.noc_audit_log (noc_id, action, performed_by) values (v_noc_id, 'Deleted', public.current_profile_id());
  end if;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'NOC Deleted', 'noc', p_profile_id);
end;
$$;
revoke all on function public.delete_noc(uuid) from public, anon;
grant execute on function public.delete_noc(uuid) to authenticated;
