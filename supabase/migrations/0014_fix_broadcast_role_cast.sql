-- Fix: broadcast_notification's "role" audience branch compared
-- profiles.role (the public.user_role enum) directly against p_audience_value
-- (plain text) with no cast — Postgres has no `user_role = text` operator,
-- so every "By Role" broadcast failed with 42883 ("operator does not exist").
-- Same signature as 0013, so a plain create-or-replace is enough — no drop.

create or replace function public.broadcast_notification(
  p_title text,
  p_message text,
  p_audience_type text,
  p_audience_value text
)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
  if trim(p_title) = '' or trim(p_message) = '' then raise exception 'INVALID_BROADCAST'; end if;

  if p_audience_type = 'role' then
    if p_audience_value not in ('Member', 'Team Lead', 'SPOC') then raise exception 'INVALID_AUDIENCE'; end if;

    insert into public.notifications (recipient_profile_id, type, title, message)
    select id, 'AdminBroadcast', p_title, p_message
    from public.profiles
    where role = p_audience_value::public.user_role;

  elsif p_audience_type = 'venue' then
    if not exists (select 1 from public.rooms where id = p_audience_value::uuid) then
      raise exception 'ROOM_NOT_FOUND';
    end if;

    insert into public.notifications (recipient_profile_id, type, title, message)
    select tm.profile_id, 'AdminBroadcast', p_title, p_message
    from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where t.room_id = p_audience_value::uuid;

  else
    raise exception 'INVALID_AUDIENCE';
  end if;

  get diagnostics v_count = row_count;

  insert into public.audit_logs (actor_profile_id, action, entity_type, new_value)
  values (
    public.current_profile_id(), 'Notification Broadcast', 'notification',
    jsonb_build_object(
      'audience_type', p_audience_type, 'audience_value', p_audience_value,
      'title', p_title, 'recipient_count', v_count
    )
  );

  return v_count;
end;
$$;
revoke all on function public.broadcast_notification(text, text, text, text) from public, anon;
grant execute on function public.broadcast_notification(text, text, text, text) to authenticated;
