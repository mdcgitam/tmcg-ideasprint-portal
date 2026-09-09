-- 0047_spoc_zone_manager_noc_ppt_upload.sql
-- SPOC and Zone Manager can currently only VIEW a team's NOC/PPT (and, for
-- NOC only, replace/delete an already-uploaded file) — they were never
-- granted the on-behalf-of "Admin Upload" capability Campus Admin/Super
-- Admin have, at any of the three layers that gate it: the RPC, the storage
-- bucket policy, and the client UI (removed separately, in PptSection.tsx /
-- NocIndividualsView.tsx / TeamDetailModal.tsx).
--
-- Deliberately NOT exempting SPOC/Zone Manager from the deadline check the
-- way Campus Admin/Super Admin are — this only grants the ability to upload,
-- not to override the deadline. Uses is_assigned_spoc_of_profile /
-- is_assigned_spoc_of_team throughout, which already folds in Zone Manager
-- (0036_zone_manager_access.sql), so one clause covers both roles.

-- ── record_noc_metadata: add SPOC/Zone Manager to the allowed-uploader check ──
CREATE OR REPLACE FUNCTION public.record_noc_metadata(p_profile_id uuid, p_file_path text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_action text;
  v_noc_id uuid;
  v_deadline timestamptz;
begin
  if not (
    public.is_own_or_led_profile(p_profile_id)
    or public.current_role() = 'Campus Admin' or public.is_platform_admin()
    or public.is_assigned_spoc_of_profile(p_profile_id)
  ) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'PARTICIPANT_NOT_FOUND';
  end if;
  if not public.is_platform_admin() and (public.current_role() = 'Campus Admin' and (select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus()) then
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
$function$;
revoke all on function public.record_noc_metadata(uuid, text) from public, anon;
grant execute on function public.record_noc_metadata(uuid, text) to authenticated;

-- ── record_presentation: add SPOC/Zone Manager to the allowed-uploader check ──
CREATE OR REPLACE FUNCTION public.record_presentation(p_team_id uuid, p_file_path text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_deadline timestamptz;
begin
  if not (
    public.is_led_team(p_team_id)
    or (public.current_role() = 'Campus Admin' and public.is_same_campus_team(p_team_id)) or public.is_platform_admin()
    or public.is_assigned_spoc_of_team(p_team_id)
  ) then
    raise exception 'NOT_TEAM_LEAD';
  end if;
  if not exists (select 1 from public.teams where id = p_team_id) then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  select deadline into v_deadline from public.presentations where team_id = p_team_id;
  if v_deadline is null then
    select (value #>> '{}')::timestamptz into v_deadline
    from public.configuration where key = 'ppt.general_deadline';
  end if;

  if v_deadline is not null and now() > v_deadline and not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
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
  where ((role = 'Campus Admin' and campus = (select campus from public.teams where id = p_team_id)) or role = 'Super Admin')
     or id = (select spoc_profile_id from public.teams where id = p_team_id);
end;
$function$;
revoke all on function public.record_presentation(uuid, text) from public, anon;
grant execute on function public.record_presentation(uuid, text) to authenticated;

-- ── delete_presentation: add SPOC/Zone Manager, matching delete_noc's existing shape ──
CREATE OR REPLACE FUNCTION public.delete_presentation(p_team_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (
    public.is_led_team(p_team_id)
    or public.is_assigned_spoc_of_team(p_team_id)
    or public.current_role() = 'Campus Admin' or public.is_platform_admin()
  ) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.is_platform_admin() and ((select campus from public.teams where id = p_team_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  update public.presentations set status = 'Not Uploaded', file_path = null where team_id = p_team_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'Presentation Deleted', 'presentation', p_team_id);
end;
$function$;
revoke all on function public.delete_presentation(uuid) from public, anon;
grant execute on function public.delete_presentation(uuid) to authenticated;

-- ── Storage: noc-uploads insert (update/delete/select already cover this via is_assigned_spoc_of_profile) ──
drop policy if exists noc_uploads_insert on storage.objects;
create policy noc_uploads_insert on storage.objects as permissive for INSERT to authenticated
  with check ((((bucket_id = 'noc-uploads'::text) AND (is_own_or_led_profile(((storage.foldername(name))[1])::uuid) OR is_assigned_spoc_of_profile(((storage.foldername(name))[1])::uuid) OR (("current_role"() = 'Campus Admin'::user_role) AND is_same_campus_profile(((storage.foldername(name))[1])::uuid))))) or public.is_platform_admin());

-- ── Storage: ppt-uploads insert/update/delete ──
drop policy if exists ppt_uploads_insert on storage.objects;
create policy ppt_uploads_insert on storage.objects as permissive for INSERT to authenticated
  with check ((((bucket_id = 'ppt-uploads'::text) AND (is_led_team(((storage.foldername(name))[1])::uuid) OR is_assigned_spoc_of_team(((storage.foldername(name))[1])::uuid) OR (("current_role"() = 'Campus Admin'::user_role) AND is_same_campus_team(((storage.foldername(name))[1])::uuid))))) or public.is_platform_admin());

drop policy if exists ppt_uploads_update on storage.objects;
create policy ppt_uploads_update on storage.objects as permissive for UPDATE to authenticated
  using ((((bucket_id = 'ppt-uploads'::text) AND (is_led_team(((storage.foldername(name))[1])::uuid) OR is_assigned_spoc_of_team(((storage.foldername(name))[1])::uuid) OR (("current_role"() = 'Campus Admin'::user_role) AND is_same_campus_team(((storage.foldername(name))[1])::uuid))))) or public.is_platform_admin())
  with check ((((bucket_id = 'ppt-uploads'::text) AND (is_led_team(((storage.foldername(name))[1])::uuid) OR is_assigned_spoc_of_team(((storage.foldername(name))[1])::uuid) OR (("current_role"() = 'Campus Admin'::user_role) AND is_same_campus_team(((storage.foldername(name))[1])::uuid))))) or public.is_platform_admin());

drop policy if exists ppt_uploads_delete on storage.objects;
create policy ppt_uploads_delete on storage.objects as permissive for DELETE to authenticated
  using ((((bucket_id = 'ppt-uploads'::text) AND (is_led_team(((storage.foldername(name))[1])::uuid) OR is_assigned_spoc_of_team(((storage.foldername(name))[1])::uuid) OR (("current_role"() = 'Campus Admin'::user_role) AND is_same_campus_team(((storage.foldername(name))[1])::uuid))))) or public.is_platform_admin());
