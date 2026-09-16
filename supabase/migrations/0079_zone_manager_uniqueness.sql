-- 0079_zone_manager_uniqueness.sql
-- A Zone Manager should be tied to exactly one zone at a time — mirrors the
-- existing one-SPOC-per-venue constraint in assign_spoc_to_room (0043/0056).

create or replace function public.assign_zone_manager(p_zone_id uuid, p_manager_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_existing_zone text;
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then raise exception 'NOT_ALLOWED'; end if;
  if p_manager_profile_id is not null
     and (select campus from public.profiles where id = p_manager_profile_id) is distinct from (select campus from public.zones where id = p_zone_id) then
    raise exception 'CROSS_CAMPUS';
  end if;
  if p_manager_profile_id is not null
     and not exists (select 1 from public.profiles where id = p_manager_profile_id and role = 'Zone Manager') then
    raise exception 'NOT_A_ZONE_MANAGER';
  end if;
  if p_manager_profile_id is not null then
    select name into v_existing_zone from public.zones where zone_manager_profile_id = p_manager_profile_id and id <> p_zone_id limit 1;
    if v_existing_zone is not null then
      raise exception 'ZONE_MANAGER_ALREADY_ASSIGNED:%', v_existing_zone;
    end if;
  end if;

  update public.zones set zone_manager_profile_id = p_manager_profile_id, updated_at = now() where id = p_zone_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Zone Manager Assigned', 'zone', p_zone_id, jsonb_build_object('manager_profile_id', p_manager_profile_id));
end;
$$;
revoke all on function public.assign_zone_manager(uuid, uuid) from public, anon;
grant execute on function public.assign_zone_manager(uuid, uuid) to authenticated;
