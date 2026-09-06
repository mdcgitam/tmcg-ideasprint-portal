-- Zones and Venues: rename + delete for both, from the Create-tab table.
-- Same auth model as create_room/create_zone: Campus Admin (own campus) or
-- the global Super Admin (any campus). Audit-logged.

create or replace function public.update_room_name(p_room_id uuid, p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not exists (select 1 from public.rooms where id = p_room_id) then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if not public.is_platform_admin()
     and ((select campus from public.rooms where id = p_room_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;
  if exists (select 1 from public.rooms where name = p_name and id <> p_room_id) then
    raise exception 'DUPLICATE_ROOM_NAME';
  end if;

  update public.rooms set name = p_name, updated_at = now() where id = p_room_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Venue Renamed', 'room', p_room_id, jsonb_build_object('name', p_name));
exception when unique_violation then raise exception 'DUPLICATE_ROOM_NAME';
end;
$$;
revoke all on function public.update_room_name(uuid, text) from public, anon;
grant execute on function public.update_room_name(uuid, text) to authenticated;

create or replace function public.update_zone_name(p_zone_id uuid, p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not exists (select 1 from public.zones where id = p_zone_id) then
    raise exception 'ZONE_NOT_FOUND';
  end if;
  if not public.is_platform_admin()
     and ((select campus from public.zones where id = p_zone_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;
  if exists (select 1 from public.zones where name = p_name and id <> p_zone_id) then
    raise exception 'DUPLICATE_ZONE_NAME';
  end if;

  update public.zones set name = p_name, updated_at = now() where id = p_zone_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Zone Renamed', 'zone', p_zone_id, jsonb_build_object('name', p_name));
exception when unique_violation then raise exception 'DUPLICATE_ZONE_NAME';
end;
$$;
revoke all on function public.update_zone_name(uuid, text) from public, anon;
grant execute on function public.update_zone_name(uuid, text) to authenticated;

create or replace function public.delete_room(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not exists (select 1 from public.rooms where id = p_room_id) then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if not public.is_platform_admin()
     and ((select campus from public.rooms where id = p_room_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  -- Pull every team out of this venue first (and clear the SPOC they inherited).
  update public.teams set room_id = null, spoc_profile_id = null, updated_at = now() where room_id = p_room_id;
  delete from public.rooms where id = p_room_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'Venue Deleted', 'room', p_room_id);
end;
$$;
revoke all on function public.delete_room(uuid) from public, anon;
grant execute on function public.delete_room(uuid) to authenticated;

create or replace function public.delete_zone(p_zone_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not exists (select 1 from public.zones where id = p_zone_id) then
    raise exception 'ZONE_NOT_FOUND';
  end if;
  if not public.is_platform_admin()
     and ((select campus from public.zones where id = p_zone_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  -- Venues in this zone become zone-less; teams keep their venue + SPOC.
  update public.rooms set zone_id = null, updated_at = now() where zone_id = p_zone_id;
  delete from public.zones where id = p_zone_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'Zone Deleted', 'zone', p_zone_id);
end;
$$;
revoke all on function public.delete_zone(uuid) from public, anon;
grant execute on function public.delete_zone(uuid) to authenticated;
