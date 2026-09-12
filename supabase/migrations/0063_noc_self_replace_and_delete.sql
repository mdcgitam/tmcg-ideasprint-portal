-- 0063_noc_self_replace_and_delete.sql
-- NOC previously restricted a Member to "upload once, view only after" —
-- only their Team Lead could replace or delete it on their behalf. Per
-- explicit request, a Member now gets the same self-service Replace/Delete
-- their Team Lead already had, right up until the deadline — matching the
-- pattern Exit Requests already uses (0059's is_own_or_led_profile).
-- delete_noc gains the same DEADLINE_PASSED gate record_noc_metadata
-- already had (0047/0062), with the same Campus Admin/Super Admin
-- exemption, so a delete can't bypass a closed deadline either.

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
    or public.current_role() = 'Super Admin'
  ) then
    raise exception 'NOT_ALLOWED';
  end if;
  if (select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus() then
    raise exception 'CROSS_CAMPUS';
  end if;

  select deadline into v_deadline from public.nocs where profile_id = p_profile_id;
  if v_deadline is null then
    select (value #>> '{}')::timestamptz into v_deadline
    from public.configuration where key = 'noc.general_deadline';
  end if;
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
