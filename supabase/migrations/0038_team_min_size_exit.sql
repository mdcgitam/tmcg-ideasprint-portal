-- 0038_team_min_size_exit.sql
-- Team exit rules (minimum viable team = 3):
--   * From a 4-member team a member can exit on their own; the team keeps
--     3 active members and stays Active.
--   * A member of a 3-member team cannot exit alone — all three must file
--     exit requests; approving them takes the team to 0 active members and
--     it becomes Inactive.
--   * An exited member (profiles.is_active = false) and an Inactive team
--     (fewer than 3 active members) are not part of attendance.
--
-- Applied statement-by-statement (simple protocol), same as prior migrations.

-- ── resolve_member_exit: block an approval that would drop the team below
--    3 active members unless every other active member is also exiting ────
create or replace function public.resolve_member_exit(p_request_id uuid, p_decision text)
returns void language plpgsql security definer set search_path = public as $$
declare v_profile_id uuid; v_team_id uuid;
begin
  if p_decision not in ('Approved', 'Rejected') then raise exception 'INVALID_DECISION'; end if;

  select profile_id, team_id into v_profile_id, v_team_id from public.exit_requests where id = p_request_id;
  if v_profile_id is null then raise exception 'REQUEST_NOT_FOUND'; end if;

  if not (public.is_assigned_spoc_of_team(v_team_id) or public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.is_platform_admin() and ((select t.campus from public.exit_requests er join public.teams t on t.id = er.team_id where er.id = p_request_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  if p_decision = 'Approved' then
    -- Active members other than this one; if that is already below the
    -- 3-member minimum, only allow the approval when each of them is also
    -- exiting (Requested or Approved) — i.e. the whole team is dissolving.
    if (
      select count(*) from public.team_members tm
      join public.profiles p on p.id = tm.profile_id
      where tm.team_id = v_team_id and p.is_active and tm.profile_id <> v_profile_id
    ) < 3
    and exists (
      select 1 from public.team_members tm
      join public.profiles p on p.id = tm.profile_id
      where tm.team_id = v_team_id and p.is_active and tm.profile_id <> v_profile_id
        and not exists (
          select 1 from public.exit_requests er
          where er.profile_id = tm.profile_id and er.status in ('Requested', 'Approved')
        )
    ) then
      raise exception 'TEAM_MIN_SIZE';
    end if;
  end if;

  update public.exit_requests
  set status = p_decision::public.member_exit_status, reviewed_by = public.current_profile_id(), reviewed_at = now()
  where id = p_request_id;

  if p_decision = 'Approved' then
    update public.profiles set is_active = false, deactivated_at = now() where id = v_profile_id;
  end if;

  insert into public.notifications (recipient_profile_id, type, title, message)
  values (
    v_profile_id,
    case when p_decision = 'Approved' then 'MemberExitApproved' else 'MemberExitRejected' end,
    case when p_decision = 'Approved' then 'Exit request approved' else 'Exit request rejected' end,
    case when p_decision = 'Approved' then 'Your exit request has been approved — your registration is now exited.'
         else 'Your exit request was rejected — you remain an active participant.' end
  );
end;
$$;
revoke all on function public.resolve_member_exit(uuid, text) from public, anon;
grant execute on function public.resolve_member_exit(uuid, text) to authenticated;

-- ── record_attendance: an exited member / Inactive team is not marked ────
create or replace function public.record_attendance(p_session_id uuid, p_profile_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_team_id uuid;
  v_existing_id uuid;
  v_previous_status public.attendance_status;
begin
  select team_id into v_team_id from public.team_members where profile_id = p_profile_id;
  if v_team_id is null then
    raise exception 'PARTICIPANT_NOT_FOUND';
  end if;
  if not (public.is_assigned_spoc_of_team(v_team_id) or public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.is_platform_admin() and ((select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  if not (select is_active from public.profiles where id = p_profile_id) then
    raise exception 'MEMBER_EXITED';
  end if;
  if (
    select count(*) from public.team_members tm
    join public.profiles p on p.id = tm.profile_id
    where tm.team_id = v_team_id and p.is_active
  ) < 3 then
    raise exception 'TEAM_INACTIVE';
  end if;

  select id, status into v_existing_id, v_previous_status
    from public.attendance where session_id = p_session_id and profile_id = p_profile_id;

  if v_existing_id is null then
    insert into public.attendance (session_id, profile_id, team_id, status, recorded_by)
    values (p_session_id, p_profile_id, v_team_id, p_status::public.attendance_status, public.current_profile_id());
  else
    update public.attendance
       set status = p_status::public.attendance_status, recorded_by = public.current_profile_id(), recorded_at = now()
     where id = v_existing_id;

    if v_previous_status is distinct from p_status::public.attendance_status then
      insert into public.attendance_audit_log (attendance_id, previous_status, new_status, modified_by)
      values (v_existing_id, v_previous_status, p_status::public.attendance_status, public.current_profile_id());
    end if;
  end if;
end;
$$;
revoke all on function public.record_attendance(uuid, uuid, text) from public, anon;
grant execute on function public.record_attendance(uuid, uuid, text) to authenticated;
