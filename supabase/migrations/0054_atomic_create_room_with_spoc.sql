-- 0054_atomic_create_room_with_spoc.sql
-- The Create Venue form calls create_room, then separately calls
-- assign_spoc_to_room with the chosen SPOC. If that SPOC is already
-- assigned elsewhere, assign_spoc_to_room correctly rejects it
-- (SPOC_ALREADY_ASSIGNED, 0043) — but by then create_room has already
-- committed the room, so the UI shows an error while a half-configured,
-- SPOC-less venue is silently left behind in the database.
--
-- Folds the SPOC uniqueness/role/campus checks (same as assign_spoc_to_room)
-- into create_room itself, run BEFORE the insert, so a rejected SPOC means
-- no room is created at all — one all-or-nothing call instead of two.

drop function if exists public.create_room(text, uuid, text);

create or replace function public.create_room(p_name text, p_zone_id uuid, p_campus text default null, p_spoc_profile_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_campus public.campus; v_existing_room text;
begin
  if public.is_platform_admin() then
    if p_campus is null then raise exception 'CAMPUS_REQUIRED'; end if;
    if p_campus not in ('VSP','BLR','HYD') then raise exception 'INVALID_CAMPUS'; end if;
    v_campus := p_campus::public.campus;
  elsif public.current_role() = 'Campus Admin' then
    v_campus := public.current_campus();
  else
    raise exception 'NOT_ALLOWED';
  end if;

  if p_spoc_profile_id is not null then
    if (select campus from public.profiles where id = p_spoc_profile_id) is distinct from v_campus then
      raise exception 'CROSS_CAMPUS';
    end if;
    if not exists (select 1 from public.profiles where id = p_spoc_profile_id and role = 'SPOC') then
      raise exception 'NOT_A_SPOC';
    end if;
    select name into v_existing_room from public.rooms where spoc_profile_id = p_spoc_profile_id limit 1;
    if v_existing_room is not null then
      raise exception 'SPOC_ALREADY_ASSIGNED:%', v_existing_room;
    end if;
  end if;

  insert into public.rooms (name, zone_id, campus, spoc_profile_id) values (p_name, p_zone_id, v_campus, p_spoc_profile_id) returning id into v_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Room Created', 'room', v_id, jsonb_build_object('name', p_name, 'spoc_profile_id', p_spoc_profile_id));
  return v_id;
exception when unique_violation then raise exception 'DUPLICATE_ROOM_NAME';
end;
$$;
revoke all on function public.create_room(text, uuid, text, uuid) from public, anon;
grant execute on function public.create_room(text, uuid, text, uuid) to authenticated;
