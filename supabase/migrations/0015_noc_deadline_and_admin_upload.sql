-- NOC submission deadlines (per participant, extendable) + letting Super
-- Admin upload a NOC on someone's behalf + lowering the upload cap to 2MB.

alter table public.nocs add column deadline timestamptz;

update storage.buckets set file_size_limit = 2097152 where id = 'noc-uploads';

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

  insert into public.notifications (recipient_profile_id, type, title, message)
  select tm.profile_id, 'NocUploaded', 'NOC uploaded', 'A team NOC was uploaded.'
  from public.team_members tm
  where tm.team_id = (select team_id from public.team_members where profile_id = p_profile_id) and tm.is_lead = true;
end;
$$;
revoke all on function public.record_noc_metadata(uuid, text) from public, anon;
grant execute on function public.record_noc_metadata(uuid, text) to authenticated;

drop policy if exists noc_uploads_insert on storage.objects;
create policy noc_uploads_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'noc-uploads'
  and (public.is_own_or_led_profile((storage.foldername(name))[1]::uuid) or public.current_role() = 'Super Admin')
);

create or replace function public.extend_noc_deadline(p_profile_id uuid, p_deadline timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_assigned_spoc_of_profile(p_profile_id) or public.current_role() = 'Super Admin') then
    raise exception 'NOT_ALLOWED';
  end if;

  insert into public.nocs (profile_id, deadline) values (p_profile_id, p_deadline)
  on conflict (profile_id) do update set deadline = excluded.deadline, updated_at = now();

  insert into public.notifications (recipient_profile_id, type, title, message)
  values (p_profile_id, 'NocDeadlineExtended', 'NOC deadline extended', 'Your NOC submission deadline has been extended.');
end;
$$;
revoke all on function public.extend_noc_deadline(uuid, timestamptz) from public, anon;
grant execute on function public.extend_noc_deadline(uuid, timestamptz) to authenticated;
