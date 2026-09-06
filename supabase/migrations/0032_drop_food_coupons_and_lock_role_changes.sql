-- 0032_drop_food_coupons_and_lock_role_changes.sql
--  * Food coupons were dropped as a feature (ideasprint_changes.pdf item 14) but
--    the table / enum / RPC lingered. Remove them, and strip the now-dead
--    `delete from food_coupons` from delete_team / delete_member.
--  * update_user_role: staff-account role changes only. Team Lead and Member
--    roles come exclusively from team registration, never from an admin.

-- delete_team: drop food_coupons cleanup
CREATE OR REPLACE FUNCTION public.delete_team(p_team_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_profile_id uuid;
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then raise exception 'NOT_ALLOWED'; end if;
  if not public.is_platform_admin() and ((select campus from public.teams where id = p_team_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;
  if not exists (select 1 from public.teams where id = p_team_id) then raise exception 'TEAM_NOT_FOUND'; end if;

  update public.teams set team_lead_profile_id = null where id = p_team_id;

  update public.audit_logs set actor_profile_id = null
  where actor_profile_id in (select profile_id from public.team_members where team_id = p_team_id);

  delete from public.approval_requests where team_id = p_team_id;
  delete from public.problem_statement_selections where team_id = p_team_id;
  delete from public.exit_requests where team_id = p_team_id;

  for v_profile_id in select profile_id from public.team_members where team_id = p_team_id loop
    delete from public.attendance where profile_id = v_profile_id;
    delete from public.nocs where profile_id = v_profile_id;
  end loop;

  delete from public.exit_forms where team_id = p_team_id;
  delete from public.presentations where team_id = p_team_id;

  delete from public.profiles where id in (select profile_id from public.team_members where team_id = p_team_id);

  delete from public.teams where id = p_team_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'Team Deleted', 'team', p_team_id);
end;
$function$;
revoke all on function public.delete_team(uuid) from public, anon;
grant execute on function public.delete_team(uuid) to authenticated;

-- delete_member: drop food_coupons cleanup
CREATE OR REPLACE FUNCTION public.delete_member(p_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then raise exception 'NOT_ALLOWED'; end if;
  if not public.is_platform_admin() and ((select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;
  if exists (select 1 from public.team_members where profile_id = p_profile_id and is_lead) then
    raise exception 'CANNOT_DELETE_LEAD';
  end if;

  update public.audit_logs set actor_profile_id = null where actor_profile_id = p_profile_id;
  delete from public.approval_requests where requested_by = p_profile_id;
  delete from public.problem_statement_selections where selected_by = p_profile_id;
  delete from public.exit_requests where profile_id = p_profile_id;

  -- Rows this profile acted on for someone else (e.g. as Team Lead) --
  -- these aren't "about" this profile so the profile_id-keyed deletes
  -- below never touch them.
  delete from public.noc_audit_log where performed_by = p_profile_id;
  update public.nocs set uploaded_by = null where uploaded_by = p_profile_id;
  update public.presentations set uploaded_by = null where uploaded_by = p_profile_id;

  delete from public.attendance where profile_id = p_profile_id;
  delete from public.nocs where profile_id = p_profile_id;
  -- Cascades team_members (profile_id ON DELETE CASCADE).
  delete from public.profiles where id = p_profile_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'Member Deleted', 'profile', p_profile_id);
end;
$function$;
revoke all on function public.delete_member(uuid) from public, anon;
grant execute on function public.delete_member(uuid) to authenticated;

-- update_user_role: staff roles only (no Team Lead / Member)
CREATE OR REPLACE FUNCTION public.update_user_role(p_profile_id uuid, p_new_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_previous_role public.user_role;
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_new_role in ('Super Admin', 'Campus Admin') and not public.is_platform_admin() then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_new_role not in ('SPOC', 'Campus Admin', 'Super Admin') then
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
$function$;
revoke all on function public.update_user_role(uuid, text) from public, anon;
grant execute on function public.update_user_role(uuid, text) to authenticated;

-- drop the feature
drop function if exists public.record_food_redemption(uuid, text, text);
drop table if exists public.food_coupons cascade;
drop type if exists public.meal_status;
