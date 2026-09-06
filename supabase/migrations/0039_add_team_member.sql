-- 0039_add_team_member.sql
-- Campus Admin / Super Admin team-roster management, bounded by team size:
--   * delete_member now refuses when the team is already at the 3-member
--     minimum (an admin can't unilaterally shrink a team below viable).
--   * add_team_member adds a Member (never a Team Lead) to a team, refused
--     once the team already has 4 members.
--
-- teams.member_count is kept correct by trg_sync_team_member_count (0037).
-- Applied statement-by-statement (simple protocol), same as prior migrations.

-- ── delete_member: keep the team at 3+ ──────────────────────────────────
create or replace function public.delete_member(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_team_id uuid;
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then raise exception 'NOT_ALLOWED'; end if;
  if not public.is_platform_admin() and ((select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;
  if exists (select 1 from public.team_members where profile_id = p_profile_id and is_lead) then
    raise exception 'CANNOT_DELETE_LEAD';
  end if;

  select team_id into v_team_id from public.team_members where profile_id = p_profile_id;

  -- Removing an active member can't take the team below the 3-member
  -- minimum. (Removing an already-exited member is always fine.)
  if v_team_id is not null
     and (select is_active from public.profiles where id = p_profile_id)
     and (
       select count(*) from public.team_members tm
       join public.profiles p on p.id = tm.profile_id
       where tm.team_id = v_team_id and p.is_active
     ) <= 3 then
    raise exception 'TEAM_MIN_SIZE';
  end if;

  update public.audit_logs set actor_profile_id = null where actor_profile_id = p_profile_id;
  delete from public.approval_requests where requested_by = p_profile_id;
  delete from public.problem_statement_selections where selected_by = p_profile_id;
  delete from public.exit_requests where profile_id = p_profile_id;

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
$$;
revoke all on function public.delete_member(uuid) from public, anon;
grant execute on function public.delete_member(uuid) to authenticated;

-- ── add_team_member: add a Member, refused past 4 ───────────────────────
create or replace function public.add_team_member(
  p_team_id uuid,
  p_name text,
  p_gitam_email text,
  p_phone text,
  p_reg_no text,
  p_graduation text,
  p_program text,
  p_year_of_study text,
  p_school text,
  p_department text,
  p_branch text,
  p_gender text,
  p_stay text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_campus public.campus;
  v_user_id text;
  v_profile_id uuid;
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then raise exception 'NOT_ALLOWED'; end if;

  select campus into v_campus from public.teams where id = p_team_id;
  if v_campus is null then raise exception 'TEAM_NOT_FOUND'; end if;
  if not public.is_platform_admin() and v_campus is distinct from public.current_campus() then
    raise exception 'CROSS_CAMPUS';
  end if;

  if (select count(*) from public.team_members where team_id = p_team_id) >= 4 then
    raise exception 'TEAM_MAX_SIZE';
  end if;

  if exists (select 1 from public.profiles where gitam_email = lower(p_gitam_email)) then
    raise exception 'DUPLICATE_EMAIL:%', p_gitam_email;
  end if;
  if exists (select 1 from public.profiles where reg_no = p_reg_no) then
    raise exception 'DUPLICATE_REGNO:%', p_reg_no;
  end if;
  if exists (select 1 from public.profiles where phone = p_phone) then
    raise exception 'DUPLICATE_PHONE:%', p_phone;
  end if;

  perform public.validate_member_academics(
    coalesce(nullif(btrim(p_name), ''), 'New member'),
    p_name, p_reg_no, p_gitam_email, p_phone,
    p_graduation, p_program, p_year_of_study,
    p_school, p_department, p_branch, p_gender, p_stay, true
  );

  v_user_id := public.next_user_id(v_campus::text);

  insert into public.profiles (
    user_id, campus, role, name, gitam_email, phone, reg_no,
    graduation, program, year_of_study, school, department, branch, gender, stay
  ) values (
    v_user_id, v_campus, 'Member',
    p_name, lower(p_gitam_email), p_phone, p_reg_no,
    p_graduation, p_program, p_year_of_study, p_school, p_department, p_branch, p_gender, p_stay
  ) returning id into v_profile_id;

  insert into public.team_members (team_id, profile_id, is_lead) values (p_team_id, v_profile_id, false);

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Member Added', 'profile', v_profile_id,
          jsonb_build_object('team_id', p_team_id, 'name', p_name, 'gitam_email', lower(p_gitam_email)));

  return v_profile_id;
end;
$$;
revoke all on function public.add_team_member(uuid, text, text, text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.add_team_member(uuid, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;
