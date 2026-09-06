-- Zone Manager: a staff role of its own, distinct from SPOC. A Zone Manager
-- supervises the SPOCs of the venues in the zone(s) they manage. Created the
-- same way as a SPOC (Campus Admin -> own campus / Super Admin -> explicit
-- campus). assign_zone_manager now requires the target to actually be a
-- Zone Manager.
--
-- ADD VALUE must not be used in the transaction that creates it — this file
-- is applied statement-by-statement (simple protocol), so the value is
-- committed before the functions below reference it.

alter type public.user_role add value if not exists 'Zone Manager';

create or replace function public.create_zone_manager(p_name text, p_email text, p_campus text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_campus public.campus;
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
  if exists (select 1 from public.profiles where gitam_email = lower(p_email)) then
    raise exception 'DUPLICATE_EMAIL:%', p_email;
  end if;
  insert into public.profiles (user_id, campus, role, name, gitam_email)
  values (public.next_user_id(v_campus::text), v_campus, 'Zone Manager', p_name, lower(p_email))
  returning id into v_id;
  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Staff Account Created', 'profile', v_id,
          jsonb_build_object('role', 'Zone Manager', 'email', p_email, 'campus', v_campus));
  return v_id;
end;
$$;
revoke all on function public.create_zone_manager(text, text, text) from public, anon;
grant execute on function public.create_zone_manager(text, text, text) to authenticated;

create or replace function public.assign_zone_manager(p_zone_id uuid, p_manager_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
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

  update public.zones set zone_manager_profile_id = p_manager_profile_id, updated_at = now() where id = p_zone_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Zone Manager Assigned', 'zone', p_zone_id, jsonb_build_object('manager_profile_id', p_manager_profile_id));
end;
$$;
revoke all on function public.assign_zone_manager(uuid, uuid) from public, anon;
grant execute on function public.assign_zone_manager(uuid, uuid) to authenticated;

create or replace function public.delete_zone_manager(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then raise exception 'NOT_ALLOWED'; end if;
  if not public.is_platform_admin()
     and ((select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile_id and role = 'Zone Manager') then
    raise exception 'NOT_A_ZONE_MANAGER';
  end if;

  update public.zones set zone_manager_profile_id = null, updated_at = now() where zone_manager_profile_id = p_profile_id;
  delete from public.profiles where id = p_profile_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'Zone Manager Deleted', 'profile', p_profile_id);
end;
$$;
revoke all on function public.delete_zone_manager(uuid) from public, anon;
grant execute on function public.delete_zone_manager(uuid) to authenticated;

create or replace function public.update_user_role(p_profile_id uuid, p_new_role text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_previous_role public.user_role;
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_new_role in ('Super Admin', 'Campus Admin') and not public.is_platform_admin() then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_new_role not in ('SPOC', 'Zone Manager', 'Campus Admin', 'Super Admin') then
    raise exception 'INVALID_ROLE';
  end if;
  if not public.is_platform_admin() and ((select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  select role into v_previous_role from public.profiles where id = p_profile_id;

  update public.profiles set role = p_new_role::public.user_role, updated_at = now() where id = p_profile_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, previous_value, new_value)
  values (public.current_profile_id(), 'User Role Changed', 'profile', p_profile_id,
          jsonb_build_object('role', v_previous_role), jsonb_build_object('role', p_new_role));
end;
$$;
revoke all on function public.update_user_role(uuid, text) from public, anon;
grant execute on function public.update_user_role(uuid, text) to authenticated;
