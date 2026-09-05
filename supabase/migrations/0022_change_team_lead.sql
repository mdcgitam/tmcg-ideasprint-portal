-- Lets Super Admin reassign a team's lead from the Teams section (Manage
-- Team panel) — flips team_members.is_lead, teams.team_lead_profile_id, and
-- profiles.role together so every RLS policy/RPC keyed on current_role() =
-- 'Team Lead' + current_team_id() (is_led_team, is_own_or_led_profile, etc.
-- from 0002) keeps working unmodified for whoever holds the role now.

create or replace function public.change_team_lead(p_team_id uuid, p_new_lead_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_old_lead_profile_id uuid;
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;

  if not exists (
    select 1 from public.team_members where team_id = p_team_id and profile_id = p_new_lead_profile_id
  ) then
    raise exception 'PARTICIPANT_NOT_FOUND';
  end if;

  select profile_id into v_old_lead_profile_id
  from public.team_members where team_id = p_team_id and is_lead = true;

  if v_old_lead_profile_id = p_new_lead_profile_id then
    raise exception 'ALREADY_LEAD';
  end if;

  update public.team_members set is_lead = false where team_id = p_team_id and is_lead = true;
  update public.team_members set is_lead = true where team_id = p_team_id and profile_id = p_new_lead_profile_id;

  update public.teams set team_lead_profile_id = p_new_lead_profile_id, updated_at = now() where id = p_team_id;

  update public.profiles set role = 'Team Lead', updated_at = now() where id = p_new_lead_profile_id;
  if v_old_lead_profile_id is not null then
    update public.profiles set role = 'Member', updated_at = now() where id = v_old_lead_profile_id;
  end if;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, previous_value, new_value)
  values (
    public.current_profile_id(), 'Team Lead Changed', 'team', p_team_id,
    jsonb_build_object('lead_profile_id', v_old_lead_profile_id),
    jsonb_build_object('lead_profile_id', p_new_lead_profile_id)
  );

  insert into public.notifications (recipient_profile_id, type, title, message)
  values (p_new_lead_profile_id, 'TeamLeadChanged', 'You are now the Team Lead', 'A Super Admin made you this team''s Team Lead.');
end;
$$;
revoke all on function public.change_team_lead(uuid, uuid) from public, anon;
grant execute on function public.change_team_lead(uuid, uuid) to authenticated;
