-- 0064_noc_deadline_latest_edit_wins.sql
-- The General NOC Deadline (Configuration) already resolves "campus
-- override vs global default, whichever was saved more recently wins"
-- (0048/0049) — but a per-member override set from the NOC page
-- (extend_noc_deadline) was never part of that comparison: once set, it
-- won forever, regardless of whether the general deadline was pushed
-- later. That's exactly the reported symptom — changing the General NOC
-- Deadline updated members who never had an individual override, but did
-- nothing for members an admin had previously bulk/row-extended, some of
-- whom were now stuck showing an old, already-passed deadline.
--
-- Fix: nocs gets its own deadline_updated_at (separate from the generic
-- updated_at, which also moves on every file upload and so can't be used
-- to mean "when was the deadline itself last set"). The effective
-- deadline for a person is now whichever of {global general, campus
-- general, individual override} has the latest updated_at — same
-- "latest edit wins" rule already used between global and campus,
-- extended to include the individual override as a third candidate.
-- Centralized in one new helper (effective_noc_deadline) so
-- record_noc_metadata and delete_noc can't disagree with each other.

alter table public.nocs add column deadline_updated_at timestamptz;
-- Backfill: approximate "when was the deadline last set" with the row's
-- existing updated_at for anyone who already has an override, so already-
-- configured deadlines keep behaving as they do today until the next
-- edit on either side actually changes something.
update public.nocs set deadline_updated_at = updated_at where deadline is not null;

create or replace function public.extend_noc_deadline(p_profile_id uuid, p_deadline timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_assigned_spoc_of_profile(p_profile_id) or public.current_role() = 'Super Admin') then
    raise exception 'NOT_ALLOWED';
  end if;
  if (select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus() then
    raise exception 'CROSS_CAMPUS';
  end if;

  insert into public.nocs (profile_id, deadline, deadline_updated_at) values (p_profile_id, p_deadline, now())
  on conflict (profile_id) do update set deadline = excluded.deadline, deadline_updated_at = now(), updated_at = now();
end;
$$;
revoke all on function public.extend_noc_deadline(uuid, timestamptz) from public, anon;
grant execute on function public.extend_noc_deadline(uuid, timestamptz) to authenticated;

create or replace function public.effective_noc_deadline(p_profile_id uuid)
returns timestamptz language plpgsql stable security definer set search_path = public as $$
declare
  v_campus text;
  v_individual_deadline timestamptz;
  v_individual_updated timestamptz;
  v_global_value timestamptz;
  v_global_updated timestamptz;
  v_campus_value timestamptz;
  v_campus_updated timestamptz;
  v_general_deadline timestamptz;
  v_general_updated timestamptz;
begin
  select campus::text into v_campus from public.profiles where id = p_profile_id;

  select deadline, deadline_updated_at into v_individual_deadline, v_individual_updated
  from public.nocs where profile_id = p_profile_id;

  select (value #>> '{}')::timestamptz, updated_at into v_global_value, v_global_updated
  from public.configuration where key = 'noc.general_deadline';

  if v_campus is not null then
    select (value #>> '{}')::timestamptz, updated_at into v_campus_value, v_campus_updated
    from public.configuration where key = 'noc.general_deadline.' || v_campus;
  end if;

  if v_campus_value is not null and (v_global_value is null or v_campus_updated >= v_global_updated) then
    v_general_deadline := v_campus_value;
    v_general_updated := v_campus_updated;
  else
    v_general_deadline := v_global_value;
    v_general_updated := v_global_updated;
  end if;

  if v_individual_deadline is not null and (v_general_deadline is null or v_individual_updated >= v_general_updated) then
    return v_individual_deadline;
  end if;
  return v_general_deadline;
end;
$$;
revoke all on function public.effective_noc_deadline(uuid) from public, anon, authenticated;

create or replace function public.record_noc_metadata(p_profile_id uuid, p_file_path text)
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

  v_deadline := public.effective_noc_deadline(p_profile_id);
  if v_deadline is null and not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'DEADLINE_NOT_SET';
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
