-- Fix: delete_team (0006/0009) failed with a foreign-key violation for any
-- team that had ever selected a problem statement or submitted an edit
-- request — both very common, ordinary occurrences — because:
--   - problem_statement_selections.selected_by (the Team Lead's profile)
--   - approval_requests.requested_by (the Team Lead's profile)
--   - audit_logs.actor_profile_id (set by select_problem_statement)
-- all reference profiles(id) with no ON DELETE clause, and none of them
-- were cleaned up before the function deleted the team's member profiles.
-- The first two only get cascade-cleaned via the teams row itself, which
-- delete_team removes *after* the profiles — too late. Fixed by explicitly
-- clearing all three before the profile delete, same as the existing
-- exit_forms/presentations lines. audit_logs rows are preserved (actor
-- nulled, not deleted) since it's meant to be a permanent audit trail.

create or replace function public.delete_team(p_team_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_profile_id uuid;
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
  if not exists (select 1 from public.teams where id = p_team_id) then raise exception 'TEAM_NOT_FOUND'; end if;

  update public.teams set team_lead_profile_id = null where id = p_team_id;

  update public.audit_logs set actor_profile_id = null
  where actor_profile_id in (select profile_id from public.team_members where team_id = p_team_id);

  delete from public.approval_requests where team_id = p_team_id;
  delete from public.problem_statement_selections where team_id = p_team_id;

  for v_profile_id in select profile_id from public.team_members where team_id = p_team_id loop
    delete from public.attendance where profile_id = v_profile_id;
    delete from public.food_coupons where profile_id = v_profile_id;
    delete from public.nocs where profile_id = v_profile_id;
  end loop;

  delete from public.exit_forms where team_id = p_team_id;
  delete from public.presentations where team_id = p_team_id;

  delete from public.profiles where id in (select profile_id from public.team_members where team_id = p_team_id);

  delete from public.teams where id = p_team_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'Team Deleted', 'team', p_team_id);
end;
$$;
revoke all on function public.delete_team(uuid) from public, anon;
grant execute on function public.delete_team(uuid) to authenticated;
