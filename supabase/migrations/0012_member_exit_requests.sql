-- Per-member exit requests, replacing the team-level exit_forms flow in the
-- app (exit_forms/its bucket/RPCs are left in the database untouched, just
-- no longer used by any client code — see app-layer changes in this PR).
-- A member requests to leave (uploads their signed form), a SPOC/Super
-- Admin approves or rejects it; approval deactivates that person's profile.

create type public.member_exit_status as enum ('Requested', 'Approved', 'Rejected');

create table public.exit_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique not null references public.profiles(id),
  team_id uuid not null references public.teams(id),
  file_path text,
  status public.member_exit_status not null default 'Requested',
  reason text,
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz
);

alter table public.profiles add column is_active boolean not null default true;
alter table public.profiles add column deactivated_at timestamptz;

alter table public.exit_requests enable row level security;

-- Same shape as nocs_select (SPEC §39-48): self, that profile's Team Lead,
-- assigned SPOC, or Super Admin.
create policy exit_requests_select on public.exit_requests for select to authenticated
using (
  profile_id = public.current_profile_id()
  or public.is_led_profile(profile_id)
  or public.is_assigned_spoc_of_profile(profile_id)
  or public.current_role() = 'Super Admin'
);

-- ── Storage bucket ───────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exit-requests', 'exit-requests', false, 5242880, array['application/pdf']);

-- Path convention matches noc-uploads: exit-requests/{profile_id}/{filename}.
create policy exit_requests_select_storage on storage.objects for select to authenticated
using (
  bucket_id = 'exit-requests'
  and (
    public.is_own_or_led_profile((storage.foldername(name))[1]::uuid)
    or public.is_assigned_spoc_of_profile((storage.foldername(name))[1]::uuid)
    or public.current_role() = 'Super Admin'
  )
);

create policy exit_requests_insert_storage on storage.objects for insert to authenticated
with check (
  bucket_id = 'exit-requests'
  and public.is_own_or_led_profile((storage.foldername(name))[1]::uuid)
);

-- Update/delete: Team Lead or Super Admin only — matches delete_noc's
-- permission model (not SPOC, not self once submitted).
create policy exit_requests_update_storage on storage.objects for update to authenticated
using (
  bucket_id = 'exit-requests'
  and (public.is_led_profile((storage.foldername(name))[1]::uuid) or public.current_role() = 'Super Admin')
)
with check (
  bucket_id = 'exit-requests'
  and (public.is_led_profile((storage.foldername(name))[1]::uuid) or public.current_role() = 'Super Admin')
);

create policy exit_requests_delete_storage on storage.objects for delete to authenticated
using (
  bucket_id = 'exit-requests'
  and (public.is_led_profile((storage.foldername(name))[1]::uuid) or public.current_role() = 'Super Admin')
);

-- ── RPCs ─────────────────────────────────────────────────────────────────

create or replace function public.request_member_exit(p_profile_id uuid, p_file_path text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_team_id uuid;
begin
  if not public.is_own_or_led_profile(p_profile_id) then raise exception 'NOT_ALLOWED'; end if;

  select team_id into v_team_id from public.team_members where profile_id = p_profile_id;
  if v_team_id is null then raise exception 'PARTICIPANT_NOT_FOUND'; end if;

  insert into public.exit_requests (profile_id, team_id, file_path, status, reason, requested_at, reviewed_by, reviewed_at)
  values (p_profile_id, v_team_id, p_file_path, 'Requested', p_reason, now(), null, null)
  on conflict (profile_id) do update
    set team_id = excluded.team_id, file_path = excluded.file_path, status = 'Requested',
        reason = excluded.reason, requested_at = now(), reviewed_by = null, reviewed_at = null;

  insert into public.notifications (recipient_profile_id, type, title, message)
  select id, 'MemberExitRequested', 'Exit request submitted', 'A team member has requested to exit the event.'
  from public.profiles
  where role = 'Super Admin' or id = (select spoc_profile_id from public.teams where id = v_team_id);
end;
$$;
revoke all on function public.request_member_exit(uuid, text, text) from public, anon;
grant execute on function public.request_member_exit(uuid, text, text) to authenticated;

create or replace function public.resolve_member_exit(p_request_id uuid, p_decision text)
returns void language plpgsql security definer set search_path = public as $$
declare v_profile_id uuid; v_team_id uuid;
begin
  if p_decision not in ('Approved', 'Rejected') then raise exception 'INVALID_DECISION'; end if;

  select profile_id, team_id into v_profile_id, v_team_id from public.exit_requests where id = p_request_id;
  if v_profile_id is null then raise exception 'REQUEST_NOT_FOUND'; end if;

  if not (public.is_assigned_spoc_of_team(v_team_id) or public.current_role() = 'Super Admin') then
    raise exception 'NOT_ALLOWED';
  end if;

  update public.exit_requests
  set status = p_decision::public.member_exit_status, reviewed_by = public.current_profile_id(), reviewed_at = now()
  where id = p_request_id;

  if p_decision = 'Approved' then
    update public.profiles set is_active = false, deactivated_at = now() where id = v_profile_id;
  end if;

  insert into public.notifications (recipient_profile_id, type, title, message)
  values (
    v_profile_id,
    case when p_decision = 'Approved' then 'MemberExitApproved' else 'MemberExitRejected' end,
    case when p_decision = 'Approved' then 'Exit request approved' else 'Exit request rejected' end,
    case when p_decision = 'Approved' then 'Your exit request has been approved — your registration is now exited.'
         else 'Your exit request was rejected — you remain an active participant.' end
  );
end;
$$;
revoke all on function public.resolve_member_exit(uuid, text) from public, anon;
grant execute on function public.resolve_member_exit(uuid, text) to authenticated;

create or replace function public.delete_exit_request(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_led_profile(p_profile_id) or public.current_role() = 'Super Admin') then
    raise exception 'NOT_ALLOWED';
  end if;

  delete from public.exit_requests where profile_id = p_profile_id;
end;
$$;
revoke all on function public.delete_exit_request(uuid) from public, anon;
grant execute on function public.delete_exit_request(uuid) to authenticated;

-- delete_team (0006/0009/0011) must also clean up exit_requests — same
-- "references profiles(id) with no ON DELETE clause" reasoning as 0011.
create or replace function public.delete_team(p_team_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_profile_id uuid;
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
  if not exists (select 1 from public.teams where id = p_team_id) then raise exception 'TEAM_NOT_FOUND'; end if;

  update public.teams set team_lead_profile_id = null where id = p_team_id;

  update public.audit_logs set actor_profile_id = null
  where actor_profile_id in (select profile_id from public.team_members where team_id = p_team_id);

  delete from public.approval_requests where team_id = p_team_id;
  delete from public.problem_statement_selections where team_id = p_team_id;
  delete from public.exit_requests where team_id = p_team_id;

  for v_profile_id in select profile_id from public.team_members where team_id = p_team_id loop
    delete from public.attendance where profile_id = v_profile_id;
    delete from public.food_coupons where profile_id = v_profile_id;
    delete from public.nocs where profile_id = v_profile_id;
  end loop;

  delete from public.exit_forms where team_id = p_team_id;
  delete from public.presentations where team_id = p_team_id;

  delete from public.profiles where id in (select profile_id from public.team_members where team_id = p_team_id);

  delete from public.teams where id = p_team_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'Team Deleted', 'team', p_team_id);
end;
$$;
revoke all on function public.delete_team(uuid) from public, anon;
grant execute on function public.delete_team(uuid) to authenticated;

-- delete_member (0006) has the same bug class as delete_team did — fix it
-- the same way, defensively (a non-lead member is less likely to have
-- selected a PS or requested a team edit, but exit_requests is exactly the
-- case where an admin deletes someone who already asked to leave).
create or replace function public.delete_member(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
  if exists (select 1 from public.team_members where profile_id = p_profile_id and is_lead) then
    raise exception 'CANNOT_DELETE_LEAD';
  end if;

  update public.audit_logs set actor_profile_id = null where actor_profile_id = p_profile_id;
  delete from public.approval_requests where requested_by = p_profile_id;
  delete from public.problem_statement_selections where selected_by = p_profile_id;
  delete from public.exit_requests where profile_id = p_profile_id;

  delete from public.attendance where profile_id = p_profile_id;
  delete from public.food_coupons where profile_id = p_profile_id;
  delete from public.nocs where profile_id = p_profile_id;
  -- Cascades team_members (profile_id ON DELETE CASCADE).
  delete from public.profiles where id = p_profile_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'Member Deleted', 'profile', p_profile_id);
end;
$$;
revoke all on function public.delete_member(uuid) from public, anon;
grant execute on function public.delete_member(uuid) to authenticated;
