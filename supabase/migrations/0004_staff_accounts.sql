-- Phase 6 follow-up: SPOC/Super Admin accounts shouldn't have to go through
-- team registration just to get a profiles row to exist. Participant-only
-- fields become nullable so a staff account can be just name + email + role
-- (phone/reg_no keep their UNIQUE constraints — Postgres allows multiple
-- NULLs in a unique column, so many staff accounts can all leave them null
-- without conflict).

alter table public.profiles alter column reg_no drop not null;
alter table public.profiles alter column phone drop not null;
alter table public.profiles alter column year_of_study drop not null;
alter table public.profiles alter column school drop not null;
alter table public.profiles alter column department drop not null;
alter table public.profiles alter column branch drop not null;
alter table public.profiles alter column gender drop not null;
alter table public.profiles alter column stay drop not null;

create or replace function public.create_staff_profile(p_name text, p_email text, p_role text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_user_id text;
begin
  if public.current_role() <> 'Super Admin' then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_role not in ('SPOC', 'Super Admin') then
    raise exception 'INVALID_ROLE';
  end if;
  if exists (select 1 from public.profiles where gitam_email = lower(p_email)) then
    raise exception 'DUPLICATE_EMAIL:%', p_email;
  end if;

  v_user_id := public.next_user_id('VSP');

  insert into public.profiles (user_id, campus, role, name, gitam_email)
  values (v_user_id, 'VSP', p_role::public.user_role, p_name, lower(p_email))
  returning id into v_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Staff Account Created', 'profile', v_id, jsonb_build_object('role', p_role, 'email', p_email));

  return v_id;
end;
$$;

revoke all on function public.create_staff_profile(text, text, text) from public, anon;
grant execute on function public.create_staff_profile(text, text, text) to authenticated;
