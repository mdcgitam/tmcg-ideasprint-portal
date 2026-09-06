-- 0040_notifications_flow.sql
-- Notifications are now ONLY:
--   1. Manual sends via broadcast_notification, bounded by the sender's role:
--        Super Admin  -> Campus Admin / SPOC / Zone Manager / Team Lead / Member (any campus)
--        Campus Admin -> SPOC / Zone Manager / Team Lead / Member (own campus)
--        Zone Manager -> SPOC in their zone + Team Leads / Members of their zone
--        SPOC         -> Team Leads / Members in their room(s) only
--        Team Lead / Member -> cannot send
--   2. A system trigger only when a Team Lead submits a team edit request
--      (TeamEditRequested) or an exit form (MemberExitRequested).
--
-- Everything else that used to insert a notification (NOC/PPT uploads,
-- deadline extensions, PS changes, lead changes, exit decisions, approval
-- resolutions, ...) is silenced by a BEFORE INSERT gate rather than editing
-- each function.
--
-- Applied statement-by-statement (simple protocol), same as prior migrations.

-- ── Gate: only the allowed notification types are ever written ───────────
create or replace function public.gate_notification_type()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type in ('AdminBroadcast', 'TeamEditRequested', 'MemberExitRequested') then
    return new;
  end if;
  return null; -- silently drop any other (legacy side-effect) notification
end;
$$;

drop trigger if exists trg_gate_notification_type on public.notifications;
create trigger trg_gate_notification_type
before insert on public.notifications
for each row execute function public.gate_notification_type();

-- ── May the current user notify this profile at all? ────────────────────
create or replace function public.can_notify_target(p_target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_target and (
      -- Super Admin: any staff / participant, any campus
      (public.is_platform_admin() and p.role in ('Campus Admin','SPOC','Zone Manager','Team Lead','Member'))
      -- Campus Admin: staff + participants in their campus
      or (public.current_role() = 'Campus Admin'
          and p.role in ('SPOC','Zone Manager','Team Lead','Member')
          and p.campus = public.current_campus())
      -- Zone Manager: SPOC of a room in their zone(s), or a lead/member of a team in their zone(s)
      or (public.current_role() = 'Zone Manager' and (
            (p.role = 'SPOC' and exists (
               select 1 from public.rooms r
               join public.zones z on z.id = r.zone_id
               where z.zone_manager_profile_id = public.current_profile_id() and r.spoc_profile_id = p.id))
         or (p.role in ('Team Lead','Member') and exists (
               select 1 from public.team_members tm
               join public.teams t on t.id = tm.team_id
               join public.rooms r on r.id = t.room_id
               join public.zones z on z.id = r.zone_id
               where z.zone_manager_profile_id = public.current_profile_id() and tm.profile_id = p.id))
      ))
      -- SPOC: leads / members of teams in their room(s)
      or (public.current_role() = 'SPOC' and p.role in ('Team Lead','Member') and exists (
            select 1 from public.team_members tm
            join public.teams t on t.id = tm.team_id
            join public.rooms r on r.id = t.room_id
            where r.spoc_profile_id = public.current_profile_id() and tm.profile_id = p.id))
    )
  );
$$;
revoke all on function public.can_notify_target(uuid) from public, anon;
grant execute on function public.can_notify_target(uuid) to authenticated;

-- ── broadcast_notification: scope + optional role filter ────────────────
-- p_scope       : 'all' | 'zone' | 'venue'
-- p_scope_value : zone id / room id (ignored for 'all')
-- p_role_filter : '' (anyone) or 'Campus Admin' | 'SPOC' | 'Zone Manager' | 'Team Lead' | 'Member'
drop function if exists public.broadcast_notification(text, text, text, text);

create or replace function public.broadcast_notification(
  p_title text,
  p_message text,
  p_scope text,
  p_scope_value text,
  p_role_filter text default ''
)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer := 0;
begin
  if not (public.is_platform_admin()
          or public.current_role() in ('Campus Admin','Zone Manager','SPOC')) then
    raise exception 'NOT_ALLOWED';
  end if;
  if trim(coalesce(p_title,'')) = '' or trim(coalesce(p_message,'')) = '' then
    raise exception 'INVALID_BROADCAST';
  end if;
  if p_scope not in ('all','zone','venue') then raise exception 'INVALID_AUDIENCE'; end if;
  if coalesce(p_role_filter,'') <> ''
     and p_role_filter not in ('Campus Admin','SPOC','Zone Manager','Team Lead','Member') then
    raise exception 'INVALID_AUDIENCE';
  end if;
  if p_scope in ('zone','venue') and coalesce(p_scope_value,'') = '' then
    raise exception 'INVALID_AUDIENCE';
  end if;

  insert into public.notifications (recipient_profile_id, type, title, message)
  select p.id, 'AdminBroadcast', p_title, p_message
  from public.profiles p
  where (coalesce(p_role_filter,'') = '' or p.role = p_role_filter::public.user_role)
    and case p_scope
      when 'all' then true
      when 'zone' then
        exists (select 1 from public.rooms r
                where r.zone_id = p_scope_value::uuid and r.spoc_profile_id = p.id)
        or exists (select 1 from public.team_members tm
                   join public.teams t on t.id = tm.team_id
                   join public.rooms r on r.id = t.room_id
                   where r.zone_id = p_scope_value::uuid and tm.profile_id = p.id)
      when 'venue' then
        exists (select 1 from public.rooms r
                where r.id = p_scope_value::uuid and r.spoc_profile_id = p.id)
        or exists (select 1 from public.team_members tm
                   join public.teams t on t.id = tm.team_id
                   where t.room_id = p_scope_value::uuid and tm.profile_id = p.id)
      else false
    end
    and public.can_notify_target(p.id);

  get diagnostics v_count = row_count;

  insert into public.audit_logs (actor_profile_id, action, entity_type, new_value)
  values (
    public.current_profile_id(), 'Notification Broadcast', 'notification',
    jsonb_build_object('scope', p_scope, 'scope_value', p_scope_value,
                       'role_filter', p_role_filter, 'title', p_title, 'recipient_count', v_count)
  );

  return v_count;
end;
$$;
revoke all on function public.broadcast_notification(text, text, text, text, text) from public, anon;
grant execute on function public.broadcast_notification(text, text, text, text, text) to authenticated;

-- ── Keeper triggers: also notify the team's Zone Manager ────────────────
create or replace function public.submit_team_edit_request(p_team_id uuid, p_current_snapshot jsonb, p_requested_changes jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_request_id uuid;
begin
  if not public.is_led_team(p_team_id) then raise exception 'NOT_TEAM_LEAD'; end if;
  if exists (select 1 from public.approval_requests where team_id = p_team_id and status = 'Pending') then
    raise exception 'REQUEST_ALREADY_PENDING';
  end if;

  insert into public.approval_requests (team_id, current_snapshot, requested_changes, requested_by, status)
  values (p_team_id, p_current_snapshot, p_requested_changes, public.current_profile_id(), 'Pending')
  returning id into v_request_id;

  update public.teams set status = 'Pending Approval', updated_at = now() where id = p_team_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, previous_value, new_value)
  values (public.current_profile_id(), 'Team Edit Requested', 'team', p_team_id, p_current_snapshot, p_requested_changes);

  insert into public.notifications (recipient_profile_id, type, title, message)
  select id, 'TeamEditRequested', 'New team edit request', 'A team edit request needs review.'
  from public.profiles
  where ((role = 'Campus Admin' and campus = (select campus from public.teams where id = p_team_id)) or role = 'Super Admin')
     or id = (select spoc_profile_id from public.teams where id = p_team_id)
     or id = (select z.zone_manager_profile_id
              from public.teams t
              join public.rooms r on r.id = t.room_id
              join public.zones z on z.id = r.zone_id
              where t.id = p_team_id);

  return v_request_id;
exception
  when unique_violation then raise exception 'REQUEST_ALREADY_PENDING';
end;
$$;
revoke all on function public.submit_team_edit_request(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.submit_team_edit_request(uuid, jsonb, jsonb) to authenticated;

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
  select id, 'MemberExitRequested', 'Exit request submitted', 'A team member has submitted an exit form.'
  from public.profiles
  where ((role = 'Campus Admin' and campus = (select campus from public.teams where id = v_team_id)) or role = 'Super Admin')
     or id = (select spoc_profile_id from public.teams where id = v_team_id)
     or id = (select z.zone_manager_profile_id
              from public.teams t
              join public.rooms r on r.id = t.room_id
              join public.zones z on z.id = r.zone_id
              where t.id = v_team_id);
end;
$$;
revoke all on function public.request_member_exit(uuid, text, text) from public, anon;
grant execute on function public.request_member_exit(uuid, text, text) to authenticated;
