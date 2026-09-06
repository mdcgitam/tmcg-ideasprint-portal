-- Restore per-campus scoping of the presentation-upload notification.
--
-- 0025 (campus isolation, I3) scoped record_presentation's Super-Admin
-- notification arm to the team's campus. 0027 recreated record_presentation
-- for the admin-upload + general-deadline changes but copied the pre-0025
-- recipient query (`role = 'Super Admin' or id = spoc`), dropping that scope
-- so a PPT upload now pings Super Admins of every campus.
--
-- This is 0027's record_presentation verbatim with ONLY the notification
-- recipient query changed back to the 0025 form: same-campus Super Admins
-- plus the team's assigned SPOC.

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
  where (role = 'Super Admin' and campus = (select campus from public.teams where id = p_team_id))
     or id = (select spoc_profile_id from public.teams where id = p_team_id);
end;
$$;
revoke all on function public.record_presentation(uuid, text) from public, anon;
grant execute on function public.record_presentation(uuid, text) to authenticated;
