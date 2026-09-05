-- nocs.deadline (0015) was stored but never actually checked by
-- record_noc_metadata, and presentations had no deadline concept at all.
-- This adds a deadline column to presentations (mirroring nocs) and makes
-- both upload RPCs actually enforce it: past the deadline, uploading raises
-- DEADLINE_PASSED until a SPOC/Super Admin extends it.
--
-- Super Admin keeps its 0015 on-behalf-upload override for NOCs and is
-- exempt from the NOC deadline check accordingly (the point of that
-- override is helping someone who missed their own deadline). There's no
-- equivalent admin-upload path for presentations — only the Team Lead can
-- upload a presentation (0018) — so the presentation deadline check has no
-- such exemption.

alter table public.presentations add column if not exists deadline timestamptz;

create or replace function public.record_noc_metadata(p_profile_id uuid, p_file_path text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_action text;
  v_noc_id uuid;
  v_deadline timestamptz;
begin
  if not (public.is_own_or_led_profile(p_profile_id) or public.current_role() = 'Super Admin') then
    raise exception 'NOT_ALLOWED';
  end if;

  select deadline into v_deadline from public.nocs where profile_id = p_profile_id;
  if v_deadline is not null and now() > v_deadline and public.current_role() <> 'Super Admin' then
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
$$;
revoke all on function public.record_noc_metadata(uuid, text) from public, anon;
grant execute on function public.record_noc_metadata(uuid, text) to authenticated;

create or replace function public.record_presentation(p_team_id uuid, p_file_path text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_deadline timestamptz;
begin
  if not public.is_led_team(p_team_id) then raise exception 'NOT_TEAM_LEAD'; end if;

  select deadline into v_deadline from public.presentations where team_id = p_team_id;
  if v_deadline is not null and now() > v_deadline then
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

create or replace function public.extend_presentation_deadline(p_team_id uuid, p_deadline timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_assigned_spoc_of_team(p_team_id) or public.current_role() = 'Super Admin') then
    raise exception 'NOT_ALLOWED';
  end if;

  insert into public.presentations (team_id, deadline) values (p_team_id, p_deadline)
  on conflict (team_id) do update set deadline = excluded.deadline;

  insert into public.notifications (recipient_profile_id, type, title, message)
  select tm.profile_id, 'PresentationDeadlineExtended', 'Presentation deadline extended',
         'Your team''s presentation submission deadline has been extended.'
  from public.team_members tm
  where tm.team_id = p_team_id and tm.is_lead = true;
end;
$$;
revoke all on function public.extend_presentation_deadline(uuid, timestamptz) from public, anon;
grant execute on function public.extend_presentation_deadline(uuid, timestamptz) to authenticated;
