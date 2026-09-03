-- Admin-only editing of team names and individual member/participant details.
-- Mirrors the delete_team / delete_member pattern in 0006_ideasprint_changes.sql —
-- Super Admin only, SECURITY DEFINER, audit-logged.

create or replace function public.update_member(
  p_profile_id uuid,
  p_name text,
  p_gitam_email text,
  p_phone text,
  p_reg_no text,
  p_year_of_study text,
  p_school text,
  p_department text,
  p_branch text,
  p_gender text,
  p_stay text
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'PARTICIPANT_NOT_FOUND';
  end if;

  if exists (select 1 from public.profiles where gitam_email = lower(p_gitam_email) and id <> p_profile_id) then
    raise exception 'DUPLICATE_EMAIL:%', p_gitam_email;
  end if;
  if exists (select 1 from public.profiles where reg_no = p_reg_no and id <> p_profile_id) then
    raise exception 'DUPLICATE_REGNO:%', p_reg_no;
  end if;
  if exists (select 1 from public.profiles where phone = p_phone and id <> p_profile_id) then
    raise exception 'DUPLICATE_PHONE:%', p_phone;
  end if;

  update public.profiles set
    name = p_name,
    gitam_email = lower(p_gitam_email),
    phone = p_phone,
    reg_no = p_reg_no,
    year_of_study = p_year_of_study,
    school = p_school,
    department = p_department,
    branch = p_branch,
    gender = p_gender,
    stay = p_stay,
    updated_at = now()
  where id = p_profile_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (
    public.current_profile_id(), 'Member Updated', 'profile', p_profile_id,
    jsonb_build_object('name', p_name, 'gitam_email', lower(p_gitam_email))
  );
end;
$$;
revoke all on function public.update_member(uuid, text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.update_member(uuid, text, text, text, text, text, text, text, text, text, text) to authenticated;

create or replace function public.update_team_name(p_team_id uuid, p_team_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
  if not exists (select 1 from public.teams where id = p_team_id) then raise exception 'TEAM_NOT_FOUND'; end if;
  if exists (select 1 from public.teams where team_name = p_team_name and id <> p_team_id) then
    raise exception 'DUPLICATE_TEAM_NAME';
  end if;

  update public.teams set team_name = p_team_name, updated_at = now() where id = p_team_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Team Renamed', 'team', p_team_id, jsonb_build_object('team_name', p_team_name));
end;
$$;
revoke all on function public.update_team_name(uuid, text) from public, anon;
grant execute on function public.update_team_name(uuid, text) to authenticated;
