-- Super Admin can push a notification to every profile in a chosen audience
-- (Members, Team Leads, or SPOCs) — mirrors the SECURITY DEFINER + audit-log
-- pattern in 0006/0007. Notifications remain insert-only via RPC (no direct
-- INSERT grant on public.notifications, same as every other mutation).

create or replace function public.broadcast_notification(p_title text, p_message text, p_audience text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
  if p_audience not in ('Member', 'Team Lead', 'SPOC') then raise exception 'INVALID_AUDIENCE'; end if;
  if trim(p_title) = '' or trim(p_message) = '' then raise exception 'INVALID_BROADCAST'; end if;

  insert into public.notifications (recipient_profile_id, type, title, message)
  select id, 'AdminBroadcast', p_title, p_message
  from public.profiles
  where role = p_audience;

  get diagnostics v_count = row_count;

  insert into public.audit_logs (actor_profile_id, action, entity_type, new_value)
  values (
    public.current_profile_id(), 'Notification Broadcast', 'notification',
    jsonb_build_object('audience', p_audience, 'title', p_title, 'recipient_count', v_count)
  );

  return v_count;
end;
$$;
revoke all on function public.broadcast_notification(text, text, text) from public, anon;
grant execute on function public.broadcast_notification(text, text, text) to authenticated;
