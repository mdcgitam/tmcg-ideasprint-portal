-- 0041_broadcast_campus_and_multi_role.sql
-- broadcast_notification gains:
--   * p_scope = 'campus' (p_scope_value = 'VSP' | 'BLR' | 'HYD') — every
--     profile in that campus. Used for "Who = Campus Admins, Where = VSP".
--   * p_role_filter may be a comma-separated list of roles (e.g.
--     'Team Lead,Member'); '' still means every role in reach.
--
-- Applied statement-by-statement (simple protocol), same as prior migrations.

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
