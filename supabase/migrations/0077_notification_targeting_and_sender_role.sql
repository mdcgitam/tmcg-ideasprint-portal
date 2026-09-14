-- 0077_notification_targeting_and_sender_role.sql
-- Two additions to the Notifications module:
--   1. A single named person can now be targeted directly (on top of the
--      existing role+scope broadcast), for cases where role+scope alone
--      can't isolate one specific person — e.g. more than one Campus Admin
--      at a campus, a specific Super Admin, or one named Team Lead/Member
--      rather than "everyone at this venue." Gated by the same
--      can_notify_target check already used per-row in the bulk path, so
--      it can't be used to reach outside the caller's normal permission
--      reach.
--   2. notifications.sender_role records who (by role) sent a broadcast,
--      so a recipient's Inbox can filter "From: Campus Admin" etc. Left
--      null for system-generated notifications (NOC uploaded, exit
--      decisions, ...) — those show as unfiltered/"System" in the UI.

alter table public.notifications add column sender_role text;
alter table public.notification_broadcasts add column target_profile_id uuid references public.profiles(id) on delete set null;

drop function if exists public.broadcast_notification(text, text, text, text, text);

create or replace function public.broadcast_notification(
  p_title text,
  p_message text,
  p_scope text,
  p_scope_value text,
  p_role_filter text default '',
  p_target_profile_id uuid default null
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
  if p_scope not in ('all','zone','venue','campus') then raise exception 'INVALID_AUDIENCE'; end if;
  if p_scope in ('zone','venue','campus') and coalesce(p_scope_value,'') = '' then
    raise exception 'INVALID_AUDIENCE';
  end if;
  if p_scope = 'campus' and p_scope_value not in ('VSP','BLR','HYD') then
    raise exception 'INVALID_AUDIENCE';
  end if;
  if coalesce(p_role_filter,'') <> '' and exists (
    select 1 from unnest(string_to_array(p_role_filter, ',')) t(r)
    where btrim(t.r) not in ('Campus Admin','SPOC','Zone Manager','Team Lead','Member')
  ) then
    raise exception 'INVALID_AUDIENCE';
  end if;

  if p_target_profile_id is not null then
    -- Single-person path: can_notify_target is the caller's full, exact
    -- permission boundary already — no need to also re-derive scope/role
    -- matching here, and duplicating that logic risks a subtle mismatch
    -- with the bulk path below.
    if not public.can_notify_target(p_target_profile_id) then
      raise exception 'NOT_ALLOWED';
    end if;

    insert into public.notifications (recipient_profile_id, type, title, message, sender_role)
    values (p_target_profile_id, 'AdminBroadcast', p_title, p_message, public.current_role());
    v_count := 1;
  else
    insert into public.notifications (recipient_profile_id, type, title, message, sender_role)
    select p.id, 'AdminBroadcast', p_title, p_message, public.current_role()
    from public.profiles p
    where (
        coalesce(p_role_filter,'') = ''
        or p.role::text in (select btrim(t.r) from unnest(string_to_array(p_role_filter, ',')) t(r))
      )
      and case p_scope
        when 'all' then true
        when 'campus' then p.campus = p_scope_value::public.campus
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
  end if;

  insert into public.notification_broadcasts
    (sender_profile_id, title, message, scope, scope_value, role_filter, recipient_count, target_profile_id)
  values (
    public.current_profile_id(), p_title, p_message, p_scope, nullif(p_scope_value, ''),
    coalesce(p_role_filter, ''), v_count, p_target_profile_id
  );

  insert into public.audit_logs (actor_profile_id, action, entity_type, new_value)
  values (
    public.current_profile_id(), 'Notification Broadcast', 'notification',
    jsonb_build_object('scope', p_scope, 'scope_value', p_scope_value, 'role_filter', p_role_filter,
                       'target_profile_id', p_target_profile_id, 'title', p_title, 'recipient_count', v_count)
  );

  return v_count;
end;
$$;
revoke all on function public.broadcast_notification(text, text, text, text, text, uuid) from public, anon;
grant execute on function public.broadcast_notification(text, text, text, text, text, uuid) to authenticated;
