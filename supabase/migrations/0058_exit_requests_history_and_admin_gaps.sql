-- 0058_exit_requests_history_and_admin_gaps.sql
-- Groundwork for the redesigned Exit Requests module (Teams/Participants/
-- History tabs, matching NOC's shape) and a combined History view with
-- approval_requests (team-edit requests).
--
-- 1. exit_requests had `unique(profile_id)` and request_member_exit did an
--    upsert on it — re-submitting after a rejection silently overwrote and
--    destroyed the rejected attempt, so there was no way to ever show
--    history of more than the single latest request per person. Replaced
--    with a partial unique index (one *open* request per person at a
--    time) so resolved rows accumulate normally, same shape as
--    approval_requests' `approval_requests_one_pending_per_team`.
-- 2. Added `requested_by` (who physically filed it — matters once a Team
--    Lead can file on a member's behalf) so exit_requests has the same
--    "who/when/what/reviewed by/reviewed at" shape as approval_requests,
--    letting a History view show both types generically.
-- 3. exit_requests_select (0012) was never revisited for Campus
--    Admin/Zone Manager/platform-admin the way resolve_member_exit's
--    permission check was (0031/0038) — a Campus Admin or Zone Manager
--    could resolve an exit request they couldn't otherwise see rows for
--    via RLS outside the admin's already-scoped data fetch. Same gap
--    found in approval_requests_select (Zone Manager was never added).
--    Both fixed here with the same is_zone_manager_of_team / Campus Admin
--    clauses already used elsewhere (0044, 0046).

-- ── 1 & 2: schema ──────────────────────────────────────────────────────
alter table public.exit_requests add column requested_by uuid references public.profiles(id);
update public.exit_requests set requested_by = profile_id where requested_by is null;
alter table public.exit_requests alter column requested_by set not null;

alter table public.exit_requests drop constraint if exists exit_requests_profile_id_key;
create unique index exit_requests_one_open_per_profile on public.exit_requests (profile_id) where status = 'Requested';

-- ── request_member_exit: insert (not upsert) + requested_by + a proper
-- duplicate-open-request error instead of silently overwriting history ──
create or replace function public.request_member_exit(p_profile_id uuid, p_file_path text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_team_id uuid;
begin
  if not public.is_own_or_led_profile(p_profile_id) then raise exception 'NOT_ALLOWED'; end if;

  select team_id into v_team_id from public.team_members where profile_id = p_profile_id;
  if v_team_id is null then raise exception 'PARTICIPANT_NOT_FOUND'; end if;

  if exists (select 1 from public.exit_requests where profile_id = p_profile_id and status = 'Requested') then
    raise exception 'EXIT_REQUEST_ALREADY_PENDING';
  end if;

  insert into public.exit_requests (profile_id, team_id, file_path, status, reason, requested_at, requested_by)
  values (p_profile_id, v_team_id, p_file_path, 'Requested', p_reason, now(), public.current_profile_id());

  insert into public.notifications (recipient_profile_id, type, title, message)
  select id, 'MemberExitRequested', 'Exit request submitted', 'A team member has submitted an exit form.'
  from public.profiles
  where ((role = 'Campus Admin' and campus = (select campus from public.teams where id = v_team_id)) or role = 'Super Admin')
     or id = (select spoc_profile_id from public.teams where id = v_team_id)
     or id = (select z.zone_manager_profile_id
              from public.teams t join public.rooms r on r.id = t.room_id join public.zones z on z.id = r.zone_id
              where t.id = v_team_id);
end;
$$;
revoke all on function public.request_member_exit(uuid, text, text) from public, anon;
grant execute on function public.request_member_exit(uuid, text, text) to authenticated;

-- ── delete_exit_request ("withdraw"): only clear the open request, keep
-- any prior resolved rows as history ──
create or replace function public.delete_exit_request(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_led_profile(p_profile_id) or public.current_role() = 'Super Admin') then
    raise exception 'NOT_ALLOWED';
  end if;

  delete from public.exit_requests where profile_id = p_profile_id and status = 'Requested';
end;
$$;
revoke all on function public.delete_exit_request(uuid) from public, anon;
grant execute on function public.delete_exit_request(uuid) to authenticated;

-- ── 3: RLS gaps ────────────────────────────────────────────────────────
drop policy if exists exit_requests_select on public.exit_requests;
create policy exit_requests_select on public.exit_requests as permissive for select to authenticated
using (
  (
    (profile_id = public.current_profile_id())
    OR public.is_led_profile(exit_requests.profile_id)
    OR (team_id IN (SELECT teams.id FROM public.teams WHERE teams.spoc_profile_id = public.current_profile_id()))
    OR public.is_zone_manager_of_team(exit_requests.team_id)
    OR (("current_role"() = 'Campus Admin'::public.user_role) AND ((SELECT t.campus FROM public.teams t WHERE t.id = exit_requests.team_id) = public.current_campus()))
  )
  OR public.is_platform_admin()
);

drop policy if exists approval_requests_select on public.approval_requests;
create policy approval_requests_select on public.approval_requests as permissive for select to authenticated
using (
  (
    (team_id = public.current_team_id())
    OR (team_id IN (SELECT teams.id FROM public.teams WHERE teams.spoc_profile_id = public.current_profile_id()))
    OR public.is_zone_manager_of_team(approval_requests.team_id)
    OR (("current_role"() = 'Campus Admin'::public.user_role) AND ((SELECT t.campus FROM public.teams t WHERE t.id = approval_requests.team_id) = public.current_campus()))
  )
  OR public.is_platform_admin()
);
