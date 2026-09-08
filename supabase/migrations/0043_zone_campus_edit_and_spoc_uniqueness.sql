-- Two Zones-and-Venues fixes:
--  1. A zone's campus couldn't be changed after creation (only its name).
--     Needed so the Super Admin's "All" tab can fix a zone created under the
--     wrong campus. Blocked while the zone still has venues in it, since
--     each venue carries its own `campus` that would otherwise go stale.
--  2. assign_spoc_to_room had no check that the SPOC wasn't already the SPOC
--     of a different room — a SPOC could silently end up assigned to many
--     venues at once. Now raises SPOC_ALREADY_ASSIGNED:<room name>.

create or replace function public.update_zone_campus(p_zone_id uuid, p_campus text)
returns void language plpgsql security definer set search_path = public as $$
declare v_campus public.campus;
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
  if p_campus not in ('VSP','BLR','HYD') then
    raise exception 'INVALID_CAMPUS';
  end if;
  v_campus := p_campus::public.campus;
  if not public.is_platform_admin() and v_campus <> public.current_campus() then
    raise exception 'NOT_ALLOWED';
  end if;
  if exists (select 1 from public.rooms where zone_id = p_zone_id) then
    raise exception 'ZONE_HAS_VENUES';
  end if;

  update public.zones set campus = v_campus, updated_at = now() where id = p_zone_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Zone Campus Changed', 'zone', p_zone_id, jsonb_build_object('campus', v_campus));
end;
$$;
revoke all on function public.update_zone_campus(uuid, text) from public, anon;
grant execute on function public.update_zone_campus(uuid, text) to authenticated;

create or replace function public.assign_spoc_to_room(p_room_id uuid, p_spoc_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_existing_room text;
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then raise exception 'NOT_ALLOWED'; end if;
  if p_spoc_profile_id is not null and (select campus from public.profiles where id = p_spoc_profile_id) is distinct from (select campus from public.rooms where id = p_room_id) then raise exception 'CROSS_CAMPUS'; end if;
  if p_spoc_profile_id is not null and not exists (select 1 from public.profiles where id = p_spoc_profile_id and role = 'SPOC') then
    raise exception 'NOT_A_SPOC';
  end if;
  if p_spoc_profile_id is not null then
    select name into v_existing_room from public.rooms where spoc_profile_id = p_spoc_profile_id and id <> p_room_id limit 1;
    if v_existing_room is not null then
      raise exception 'SPOC_ALREADY_ASSIGNED:%', v_existing_room;
    end if;
  end if;

  update public.rooms set spoc_profile_id = p_spoc_profile_id, updated_at = now() where id = p_room_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Room SPOC Assigned', 'room', p_room_id, jsonb_build_object('spoc_profile_id', p_spoc_profile_id));
end;
$$;
revoke all on function public.assign_spoc_to_room(uuid, uuid) from public, anon;
grant execute on function public.assign_spoc_to_room(uuid, uuid) to authenticated;
