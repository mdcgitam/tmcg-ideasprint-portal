-- PPT module fixes (item request):
--
-- 1. Admin Upload was broken. 0018_ppt_pdf_only_16mb_lead_only.sql
--    deliberately made presentation uploads Team-Lead-only (both the RPC
--    and the storage policies), closing a Super-Admin loophole — but that
--    also disabled the legitimate "Admin Upload" column in PptSection.tsx,
--    which mirrors the NOC admin-upload path NOC already supports (0015).
--    Re-enable it the same way NOC does: Super Admin can upload/replace a
--    team's presentation, scoped to their own campus (matching the 0025
--    campus-isolation model used for every other Super-Admin storage
--    branch) — Team Lead upload is untouched.
-- 2. General PPT Deadline: teams with no individual override now fall back
--    to a single admin-configured deadline (Configuration key
--    ppt.general_deadline, same generic key/value table used for every
--    other setting — see 0003/0021). This is enforced here, not just
--    displayed client-side, so it can't be bypassed by calling the RPC
--    directly.
-- 3. Lower the ppt-uploads bucket size cap from 16MB to 2MB to match the
--    new PDF-only, 2MB requirement — the frontend already validates this,
--    but the storage-level cap must match so it can't be bypassed.

update storage.buckets
set file_size_limit = 2097152
where id = 'ppt-uploads';

-- ── Storage: let Super Admin upload/replace a presentation for a team in
-- their own campus, same shape as noc_uploads_insert (0015) and the
-- same-campus-scoped Super-Admin branches 0025 added elsewhere.

drop policy if exists ppt_uploads_insert on storage.objects;
create policy ppt_uploads_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'ppt-uploads'
  and (
    public.is_led_team((storage.foldername(name))[1]::uuid)
    or (public.current_role() = 'Super Admin' and public.is_same_campus_team((storage.foldername(name))[1]::uuid))
  )
);

drop policy if exists ppt_uploads_update on storage.objects;
create policy ppt_uploads_update on storage.objects for update to authenticated
using (
  bucket_id = 'ppt-uploads'
  and (
    public.is_led_team((storage.foldername(name))[1]::uuid)
    or (public.current_role() = 'Super Admin' and public.is_same_campus_team((storage.foldername(name))[1]::uuid))
  )
)
with check (
  bucket_id = 'ppt-uploads'
  and (
    public.is_led_team((storage.foldername(name))[1]::uuid)
    or (public.current_role() = 'Super Admin' and public.is_same_campus_team((storage.foldername(name))[1]::uuid))
  )
);

-- ── record_presentation: accept Super Admin (own campus) as an uploader,
-- exempt Super Admin from the deadline check (same on-behalf-of exemption
-- NOC already has in record_noc_metadata), and fall back to the general
-- Configuration deadline when the team has no individual override.

create or replace function public.record_presentation(p_team_id uuid, p_file_path text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_deadline timestamptz;
begin
  if not (
    public.is_led_team(p_team_id)
    or (public.current_role() = 'Super Admin' and public.is_same_campus_team(p_team_id))
  ) then
    raise exception 'NOT_TEAM_LEAD';
  end if;

  select deadline into v_deadline from public.presentations where team_id = p_team_id;
  if v_deadline is null then
    select (value #>> '{}')::timestamptz into v_deadline
    from public.configuration where key = 'ppt.general_deadline';
  end if;

  if v_deadline is not null and now() > v_deadline and public.current_role() <> 'Super Admin' then
    raise exception 'DEADLINE_PASSED';
  end if;

  insert into public.presentations (team_id, file_path, status, uploaded_by, uploaded_at)
  values (p_team_id, p_file_path, 'Uploaded', public.current_profile_id(), now())
  on conflict (team_id) do update
    set file_path = excluded.file_path, status = 'Uploaded',
        uploaded_by = excluded.uploaded_by, uploaded_at = excluded.uploaded_at;

  insert into public.notifications (recipient_profile_id, type, title, message)
  select id, 'PresentationUploaded', 'Presentation uploaded', 'A team presentation (PPT) was uploaded.'
  from public.profiles
  where role = 'Super Admin' or id = (select spoc_profile_id from public.teams where id = p_team_id);
end;
$$;
revoke all on function public.record_presentation(uuid, text) from public, anon;
grant execute on function public.record_presentation(uuid, text) to authenticated;
