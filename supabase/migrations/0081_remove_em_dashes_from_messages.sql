-- 0081_remove_em_dashes_from_messages.sql
--
-- Site-wide em dash cleanup (2026-09-19) covered every frontend string, but
-- two already-applied functions still embed an em dash in text they insert
-- into `notifications` (rendered verbatim in the Notifications tab), and
-- 0080's three configuration rows have one each in their `description`
-- (never rendered, but cleaned up for consistency). Historical migrations
-- are never edited in place — this redefines the two functions (unchanged
-- otherwise) and updates the three config rows.

-- resolve_approval_request (source: 0031) — only the rejection message text changed.
CREATE OR REPLACE FUNCTION public.resolve_approval_request(p_request_id uuid, p_decision text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_team_id uuid;
  v_status public.approval_status;
  v_requested_changes jsonb;
  v_requested_by uuid;
  v_member jsonb;
  v_team_name text;
  v_cur public.profiles%rowtype;
begin
  if p_decision not in ('Approved', 'Rejected') then
    raise exception 'INVALID_DECISION';
  end if;

  select team_id, status, requested_changes, requested_by
    into v_team_id, v_status, v_requested_changes, v_requested_by
  from public.approval_requests where id = p_request_id;

  if v_team_id is null then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if v_status <> 'Pending' then
    raise exception 'ALREADY_RESOLVED';
  end if;
  if not (public.is_assigned_spoc_of_team(v_team_id) or public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.is_platform_admin() and ((select t.campus from public.approval_requests ar join public.teams t on t.id = ar.team_id where ar.id = p_request_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  if p_decision = 'Approved' then
    v_team_name := v_requested_changes->'team'->>'teamName';
    if v_team_name is not null then
      update public.teams set team_name = v_team_name where id = v_team_id;
    end if;

    for v_member in select * from jsonb_array_elements(coalesce(v_requested_changes->'members', '[]'::jsonb)) loop
      select * into v_cur from public.profiles where id = (v_member->>'profileId')::uuid;

      perform public.validate_member_academics(
        coalesce(nullif(btrim(v_member->>'name'), ''), v_cur.name, 'This member'),
        coalesce(v_member->>'name', v_cur.name),
        v_cur.reg_no,
        v_cur.gitam_email::text,
        coalesce(v_member->>'phone', v_cur.phone),
        coalesce(v_member->>'graduation', v_cur.graduation),
        coalesce(v_member->>'program', v_cur.program),
        coalesce(v_member->>'yearOfStudy', v_cur.year_of_study),
        coalesce(v_member->>'school', v_cur.school),
        coalesce(v_member->>'department', v_cur.department),
        coalesce(v_member->>'branch', v_cur.branch),
        coalesce(v_member->>'gender', v_cur.gender),
        coalesce(v_member->>'stay', v_cur.stay),
        false
      );

      update public.profiles set
        name = coalesce(v_member->>'name', name),
        phone = coalesce(v_member->>'phone', phone),
        graduation = coalesce(v_member->>'graduation', graduation),
        program = coalesce(v_member->>'program', program),
        year_of_study = coalesce(v_member->>'yearOfStudy', year_of_study),
        school = coalesce(v_member->>'school', school),
        department = coalesce(v_member->>'department', department),
        branch = coalesce(v_member->>'branch', branch),
        gender = coalesce(v_member->>'gender', gender),
        stay = coalesce(v_member->>'stay', stay),
        updated_at = now()
      where id = (v_member->>'profileId')::uuid;
    end loop;
  end if;

  update public.approval_requests
     set status = p_decision::public.approval_status, reviewed_by = public.current_profile_id(), reviewed_at = now()
   where id = p_request_id;

  update public.teams set status = 'Registered', updated_at = now() where id = v_team_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (
    public.current_profile_id(),
    case when p_decision = 'Approved' then 'Team Edit Approved' else 'Team Edit Rejected' end,
    'team', v_team_id, v_requested_changes
  );

  insert into public.notifications (recipient_profile_id, type, title, message)
  values (
    v_requested_by,
    case when p_decision = 'Approved' then 'TeamEditApproved' else 'TeamEditRejected' end,
    case when p_decision = 'Approved' then 'Team edit approved' else 'Team edit rejected' end,
    case when p_decision = 'Approved' then 'Your requested team changes have been approved.'
         else 'Your requested team changes were rejected - your previous info is unchanged.' end
  );
end;
$function$;

-- resolve_member_exit (source: 0038) — only the approve/reject message text changed.
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
    case when p_decision = 'Approved' then 'Your exit request has been approved - your registration is now exited.'
         else 'Your exit request was rejected - you remain an active participant.' end
  );
end;
$$;

-- 0080's configuration descriptions — never rendered anywhere, but cleaned up for consistency.
update public.configuration set description = 'Maximum registered teams for Visakhapatnam - one slot per team.'
  where key = 'registration.team_cap.VSP';
update public.configuration set description = 'Maximum registered teams for Hyderabad - one slot per team.'
  where key = 'registration.team_cap.HYD';
update public.configuration set description = 'Maximum registered teams for Bangalore - one slot per team.'
  where key = 'registration.team_cap.BLR';
