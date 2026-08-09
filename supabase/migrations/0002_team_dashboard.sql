-- Phase 5 — Team Dashboard. Adds Storage buckets + storage-level RLS for
-- NOC/Exit Form uploads, a handful of small permission-check helper
-- functions (used by both the storage policies below and the RPCs), and
-- the SECURITY DEFINER RPCs every dashboard mutation goes through — no new
-- INSERT/UPDATE/DELETE grants land on `authenticated` for any table itself,
-- same rule as 0001_init_schema.sql.

-- ── Storage buckets (private — access only via short-lived signed URLs) ──

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('noc-uploads', 'noc-uploads', false, 5242880, array['application/pdf']),
  ('exit-forms', 'exit-forms', false, 5242880, array['application/pdf']);

-- ── Small permission-check helpers ──────────────────────────────────────
-- Reused by the storage policies below and by the RPCs further down, so the
-- "am I this profile's Team Lead / this team's Team Lead / their assigned
-- SPOC" logic exists in exactly one place each.

create or replace function public.is_own_or_led_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_profile_id = public.current_profile_id()
    or (
      public.current_role() = 'Team Lead'
      and p_profile_id in (select profile_id from public.team_members where team_id = public.current_team_id())
    );
$$;

create or replace function public.is_led_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() = 'Team Lead'
    and p_profile_id in (select profile_id from public.team_members where team_id = public.current_team_id());
$$;

create or replace function public.is_own_team(p_team_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_team_id = public.current_team_id();
$$;

create or replace function public.is_led_team(p_team_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() = 'Team Lead' and p_team_id = public.current_team_id();
$$;

create or replace function public.is_assigned_spoc_of_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.profile_id = p_profile_id and t.spoc_profile_id = public.current_profile_id()
  );
$$;

create or replace function public.is_assigned_spoc_of_team(p_team_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.teams where id = p_team_id and spoc_profile_id = public.current_profile_id());
$$;

-- ── Storage RLS ──────────────────────────────────────────────────────────
-- Path convention: noc-uploads/{profile_id}/{filename}, exit-forms/{team_id}/{filename}.
-- storage.foldername(name) splits the object path into segments; [1] is the
-- first folder, i.e. our profile_id / team_id.

create policy noc_uploads_select on storage.objects for select to authenticated
using (
  bucket_id = 'noc-uploads'
  and (
    public.is_own_or_led_profile((storage.foldername(name))[1]::uuid)
    or public.is_assigned_spoc_of_profile((storage.foldername(name))[1]::uuid)
    or public.current_role() = 'Super Admin'
  )
);

create policy noc_uploads_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'noc-uploads'
  and public.is_own_or_led_profile((storage.foldername(name))[1]::uuid)
);

-- Replace/delete: Team Lead, assigned SPOC, or Super Admin — SPEC §39-48, a
-- Member may upload their own NOC but not edit/replace/delete it afterward.
create policy noc_uploads_update on storage.objects for update to authenticated
using (
  bucket_id = 'noc-uploads'
  and (
    public.is_led_profile((storage.foldername(name))[1]::uuid)
    or public.is_assigned_spoc_of_profile((storage.foldername(name))[1]::uuid)
    or public.current_role() = 'Super Admin'
  )
)
with check (
  bucket_id = 'noc-uploads'
  and (
    public.is_led_profile((storage.foldername(name))[1]::uuid)
    or public.is_assigned_spoc_of_profile((storage.foldername(name))[1]::uuid)
    or public.current_role() = 'Super Admin'
  )
);

create policy noc_uploads_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'noc-uploads'
  and (
    public.is_led_profile((storage.foldername(name))[1]::uuid)
    or public.is_assigned_spoc_of_profile((storage.foldername(name))[1]::uuid)
    or public.current_role() = 'Super Admin'
  )
);

create policy exit_forms_select_storage on storage.objects for select to authenticated
using (
  bucket_id = 'exit-forms'
  and (
    public.is_own_team((storage.foldername(name))[1]::uuid)
    or public.is_assigned_spoc_of_team((storage.foldername(name))[1]::uuid)
    or public.current_role() = 'Super Admin'
  )
);

create policy exit_forms_insert_storage on storage.objects for insert to authenticated
with check (
  bucket_id = 'exit-forms'
  and (public.is_led_team((storage.foldername(name))[1]::uuid) or public.current_role() = 'Super Admin')
);

create policy exit_forms_update_storage on storage.objects for update to authenticated
using (
  bucket_id = 'exit-forms'
  and (public.is_led_team((storage.foldername(name))[1]::uuid) or public.current_role() = 'Super Admin')
)
with check (
  bucket_id = 'exit-forms'
  and (public.is_led_team((storage.foldername(name))[1]::uuid) or public.current_role() = 'Super Admin')
);

create policy exit_forms_delete_storage on storage.objects for delete to authenticated
using (
  bucket_id = 'exit-forms'
  and (public.is_led_team((storage.foldername(name))[1]::uuid) or public.current_role() = 'Super Admin')
);

-- ── RPCs ─────────────────────────────────────────────────────────────────
-- Unlike register_team (pre-auth, service-role only), these are called
-- directly by a logged-in user's own session — the permission check inside
-- each function (via the helpers above) is what makes that safe, since none
-- of these tables grant authenticated INSERT/UPDATE/DELETE directly.

create or replace function public.submit_team_edit_request(
  p_team_id uuid,
  p_current_snapshot jsonb,
  p_requested_changes jsonb
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_request_id uuid;
begin
  if not public.is_led_team(p_team_id) then
    raise exception 'NOT_TEAM_LEAD';
  end if;

  if exists (select 1 from public.approval_requests where team_id = p_team_id and status = 'Pending') then
    raise exception 'REQUEST_ALREADY_PENDING';
  end if;

  insert into public.approval_requests (team_id, current_snapshot, requested_changes, requested_by, status)
  values (p_team_id, p_current_snapshot, p_requested_changes, public.current_profile_id(), 'Pending')
  returning id into v_request_id;

  -- SPEC §23: team status auto-updates; resolve_approval_request (0003)
  -- reverts this back to 'Registered' once the request is resolved either way.
  update public.teams set status = 'Pending Approval', updated_at = now() where id = p_team_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, previous_value, new_value)
  values (public.current_profile_id(), 'Team Edit Requested', 'team', p_team_id, p_current_snapshot, p_requested_changes);

  insert into public.notifications (recipient_profile_id, type, title, message)
  select id, 'TeamEditRequested', 'New team edit request', 'A team edit request needs review.'
  from public.profiles
  where role = 'Super Admin' or id = (select spoc_profile_id from public.teams where id = p_team_id);

  return v_request_id;
exception
  when unique_violation then
    raise exception 'REQUEST_ALREADY_PENDING';
end;
$$;

revoke all on function public.submit_team_edit_request(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.submit_team_edit_request(uuid, jsonb, jsonb) to authenticated;

create or replace function public.select_problem_statement(p_team_id uuid, p_ps_number text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_ps_id uuid;
  v_ps_title text;
  v_selection_start timestamptz;
  v_selection_end timestamptz;
  v_is_initial boolean;
begin
  if not public.is_led_team(p_team_id) then
    raise exception 'NOT_TEAM_LEAD';
  end if;

  select (value #>> '{}')::timestamptz into v_selection_start
    from public.configuration where key = 'problem_statement.selection_start';
  select (value #>> '{}')::timestamptz into v_selection_end
    from public.configuration where key = 'problem_statement.selection_end';

  if v_selection_start is null or v_selection_end is null then
    raise exception 'SELECTION_NOT_CONFIGURED';
  end if;
  if now() < v_selection_start or now() > v_selection_end then
    raise exception 'SELECTION_CLOSED';
  end if;

  select id, title into v_ps_id, v_ps_title from public.problem_statements where number = p_ps_number and status = 'Released';
  if v_ps_id is null then
    raise exception 'INVALID_PS_NUMBER';
  end if;

  v_is_initial := not exists (select 1 from public.problem_statement_selections where team_id = p_team_id);

  insert into public.problem_statement_selections (team_id, problem_statement_id, selected_by, is_initial)
  values (p_team_id, v_ps_id, public.current_profile_id(), v_is_initial);

  update public.teams set current_problem_statement_id = v_ps_id, updated_at = now() where id = p_team_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Problem Statement Selected', 'team', p_team_id, jsonb_build_object('ps_number', p_ps_number));

  insert into public.notifications (recipient_profile_id, type, title, message)
  select team_lead_profile_id, 'ProblemStatementChanged', 'Problem statement updated',
         'Your team selected problem statement ' || p_ps_number
  from public.teams where id = p_team_id;

  return jsonb_build_object('id', v_ps_id, 'number', p_ps_number, 'title', v_ps_title);
end;
$$;

revoke all on function public.select_problem_statement(uuid, text) from public, anon;
grant execute on function public.select_problem_statement(uuid, text) to authenticated;

create or replace function public.record_noc_metadata(p_profile_id uuid, p_file_path text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_action text;
  v_noc_id uuid;
begin
  if not public.is_own_or_led_profile(p_profile_id) then
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

create or replace function public.delete_noc(p_profile_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_noc_id uuid;
begin
  if not (public.is_led_profile(p_profile_id) or public.current_role() = 'Super Admin') then
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

  insert into public.notifications (recipient_profile_id, type, title, message)
  values (p_profile_id, 'NocDeleted', 'NOC deleted', 'Your NOC was deleted — you can re-upload it.');
end;
$$;

revoke all on function public.delete_noc(uuid) from public, anon;
grant execute on function public.delete_noc(uuid) to authenticated;

create or replace function public.record_exit_form(p_team_id uuid, p_file_path text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_led_team(p_team_id) then
    raise exception 'NOT_TEAM_LEAD';
  end if;

  insert into public.exit_forms (team_id, file_path, status, uploaded_by, uploaded_at)
  values (p_team_id, p_file_path, 'Submitted', public.current_profile_id(), now())
  on conflict (team_id) do update
    set file_path = excluded.file_path, status = 'Submitted',
        uploaded_by = excluded.uploaded_by, uploaded_at = excluded.uploaded_at;

  insert into public.notifications (recipient_profile_id, type, title, message)
  select id, 'ExitFormUploaded', 'Exit form uploaded', 'A team exit form was uploaded.'
  from public.profiles
  where role = 'Super Admin' or id = (select spoc_profile_id from public.teams where id = p_team_id);
end;
$$;

revoke all on function public.record_exit_form(uuid, text) from public, anon;
grant execute on function public.record_exit_form(uuid, text) to authenticated;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.notifications
     set read = true
   where id = p_notification_id and recipient_profile_id = public.current_profile_id();
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;
