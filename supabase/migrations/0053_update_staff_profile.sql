-- 0053_update_staff_profile.sql
-- Staff Accounts gets an Edit action (name/email/role together, so a
-- Campus Admin/Super Admin can fix a mistyped email or name without
-- deleting and recreating the account). update_user_role (0035) only ever
-- touched role — this is the same permission model, extended to also
-- write name/gitam_email in one RPC so the UI can save all three fields
-- from a single edit form.

create or replace function public.update_staff_profile(p_profile_id uuid, p_name text, p_email text, p_new_role text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_previous_role public.user_role;
  v_previous_name text;
  v_previous_email text;
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_new_role = 'Campus Admin' and not public.is_platform_admin() then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_new_role not in ('SPOC', 'Zone Manager', 'Campus Admin') then
    raise exception 'INVALID_ROLE';
  end if;
  if not public.is_platform_admin() and ((select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;
  if trim(p_name) = '' then
    raise exception 'NAME_REQUIRED';
  end if;
  if trim(p_email) = '' then
    raise exception 'EMAIL_REQUIRED';
  end if;
  if exists (select 1 from public.profiles where gitam_email = lower(trim(p_email)) and id <> p_profile_id) then
    raise exception 'DUPLICATE_EMAIL:%', p_email;
  end if;

  select role, name, gitam_email into v_previous_role, v_previous_name, v_previous_email
  from public.profiles where id = p_profile_id;

  if v_previous_role is null then
    raise exception 'NOT_FOUND';
  end if;
  if v_previous_role not in ('SPOC', 'Zone Manager', 'Campus Admin') then
    raise exception 'NOT_ALLOWED';
  end if;

  update public.profiles
    set name = trim(p_name), gitam_email = lower(trim(p_email)), role = p_new_role::public.user_role, updated_at = now()
  where id = p_profile_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, previous_value, new_value)
  values (public.current_profile_id(), 'Staff Profile Updated', 'profile', p_profile_id,
          jsonb_build_object('name', v_previous_name, 'email', v_previous_email, 'role', v_previous_role),
          jsonb_build_object('name', trim(p_name), 'email', lower(trim(p_email)), 'role', p_new_role));
end;
$$;
revoke all on function public.update_staff_profile(uuid, text, text, text) from public, anon;
grant execute on function public.update_staff_profile(uuid, text, text, text) to authenticated;
