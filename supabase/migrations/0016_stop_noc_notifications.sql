-- Stop NOC upload/delete/deadline-extension actions from creating
-- notifications. These fired on every single-file upload and buried the
-- notifications feed, which is meant only for Super Admin broadcasts
-- (public.broadcast_notification, type = 'AdminBroadcast'). Function bodies
-- below are otherwise identical to their prior versions — only the
-- `insert into public.notifications ...` blocks are removed.

create or replace function public.record_noc_metadata(p_profile_id uuid, p_file_path text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_action text;
  v_noc_id uuid;
begin
  if not (public.is_own_or_led_profile(p_profile_id) or public.current_role() = 'Super Admin') then
    raise exception 'NOT_ALLOWED';
  end if;

  v_action := case when exists (select 1 from public.nocs where profile_id = p_profile_id) then 'Replaced' else 'Uploaded' end;

  insert into public.nocs (profile_id, file_path, status, uploaded_by, uploaded_at)
  values (p_profile_id, p_file_path, 'Uploaded', public.current_profile_id(), now())
  on conflict (profile_id) do update
    set file_path = excluded.file_path, status = 'Uploaded',
        uploaded_by = excluded.uploaded_by, uploaded_at = excluded.uploaded_at, updated_at = now()
  returning id into v_noc_id;

  insert into public.noc_audit_log (noc_id, action, performed_by) values (v_noc_id, v_action, public.current_profile_id());
end;
$$;
revoke all on function public.record_noc_metadata(uuid, text) from public, anon;
grant execute on function public.record_noc_metadata(uuid, text) to authenticated;

create or replace function public.extend_noc_deadline(p_profile_id uuid, p_deadline timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_assigned_spoc_of_profile(p_profile_id) or public.current_role() = 'Super Admin') then
    raise exception 'NOT_ALLOWED';
  end if;

  insert into public.nocs (profile_id, deadline) values (p_profile_id, p_deadline)
  on conflict (profile_id) do update set deadline = excluded.deadline, updated_at = now();
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
begin
  if not (
    public.is_led_profile(p_profile_id)
    or public.is_assigned_spoc_of_profile(p_profile_id)
    or public.current_role() = 'Super Admin'
  ) then
    raise exception 'NOT_ALLOWED';
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
