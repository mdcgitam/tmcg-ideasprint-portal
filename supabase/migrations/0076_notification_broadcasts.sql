-- 0076_notification_broadcasts.sql
-- "Sent" tab for the Notifications module. broadcast_notification already
-- inserts one public.notifications row per recipient (0041) — there's no
-- reliable way to reconstruct "what did I send" from that alone without
-- fragile grouping. This adds one row per *send event* instead, scoped to
-- the sender via RLS the same way public.notifications is scoped to the
-- recipient.

create table public.notification_broadcasts (
  id uuid primary key default gen_random_uuid(),
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  scope text not null,
  scope_value text,
  role_filter text not null default '',
  recipient_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.notification_broadcasts enable row level security;

create policy notification_broadcasts_select on public.notification_broadcasts for select to authenticated
using (sender_profile_id = public.current_profile_id());

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

  insert into public.notifications (recipient_profile_id, type, title, message)
  select p.id, 'AdminBroadcast', p_title, p_message
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

  insert into public.notification_broadcasts
    (sender_profile_id, title, message, scope, scope_value, role_filter, recipient_count)
  values (
    public.current_profile_id(), p_title, p_message, p_scope, nullif(p_scope_value, ''), coalesce(p_role_filter, ''), v_count
  );

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
