-- 0026_registration_restructuring.sql — Registration Page Restructuring.
--
-- Adds graduation + program to profiles, one shared academic-combination
-- validator, and hooks it into every write path (register_team, update_member,
-- resolve_approval_request). Non-destructive: existing rows keep their values,
-- the new columns are NULLable for legacy/staff rows, and the field-level CHECK
-- constraints are added NOT VALID so only new/changed rows must comply.
--
-- The allowed sets below MUST stay in lockstep with
-- src/lib/registration/academic.ts.

-- ── Columns ─────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists graduation text;  -- 'UG' | 'PG' | NULL (legacy/staff)
alter table public.profiles add column if not exists program text;     -- 'B.Tech' | 'M.Tech' | NULL

-- ── Safe one-time relabel ───────────────────────────────────────────────
-- The only unambiguous legacy→new value mapping (spec §13). Branch / School /
-- Year legacy values are left untouched (no reliable mapping — spec §17).
update public.profiles set stay = 'Hostel' where stay = 'Hosteller';

-- ── Field-level CHECK constraints (NOT VALID: new/changed rows only) ─────
do $$ begin
  alter table public.profiles add constraint profiles_reg_no_prefix_chk
    check (reg_no is null or reg_no ~ '^(2023|2024|2025|2026)') not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_phone_digits_chk
    check (phone is null or phone ~ '^[0-9]{10}$') not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_gitam_email_domain_chk
    check (gitam_email is null or (gitam_email)::text ~* '@(gitam\.in|student\.gitam\.edu)$') not valid;
exception when duplicate_object then null; end $$;

-- ── Shared academic validator ──────────────────────────────────────────
-- Raises `CODE: <label> — <field-specific sentence>` so the client can show
-- exactly which member and field is wrong. p_strict = true (registration /
-- admin edit) also rejects blank required fields; p_strict = false (approval
-- of a Team-Lead edit request) tolerates NULLs so unrelated edits to legacy
-- rows still go through.
create or replace function public.validate_member_academics(
  p_label text,
  p_name text,
  p_reg_no text,
  p_gitam_email text,
  p_phone text,
  p_graduation text,
  p_program text,
  p_year_of_study text,
  p_school text,
  p_department text,
  p_branch text,
  p_gender text,
  p_stay text,
  p_strict boolean default true
)
returns void language plpgsql immutable as $$
declare
  v_blank_name  constant boolean := p_name  is null or btrim(p_name)  = '';
  v_blank_reg   constant boolean := p_reg_no is null or btrim(p_reg_no) = '';
  v_blank_mail  constant boolean := p_gitam_email is null or btrim(p_gitam_email) = '';
  v_blank_phone constant boolean := p_phone is null or btrim(p_phone) = '';
  v_blank_grad  constant boolean := p_graduation is null or btrim(p_graduation) = '';
  v_blank_prog  constant boolean := p_program is null or btrim(p_program) = '';
  v_blank_year  constant boolean := p_year_of_study is null or btrim(p_year_of_study) = '';
  v_blank_schl  constant boolean := p_school is null or btrim(p_school) = '';
  v_blank_dept  constant boolean := p_department is null or btrim(p_department) = '';
  v_blank_brnch constant boolean := p_branch is null or btrim(p_branch) = '';
  v_blank_gen   constant boolean := p_gender is null or btrim(p_gender) = '';
  v_blank_stay  constant boolean := p_stay is null or btrim(p_stay) = '';
begin
  -- Full Name
  if v_blank_name then
    if p_strict then raise exception 'MISSING_FIELD: % — Full Name is required', p_label; end if;
  end if;

  -- Registration Number
  if v_blank_reg then
    if p_strict then raise exception 'MISSING_FIELD: % — Registration Number is required', p_label; end if;
  elsif left(p_reg_no, 4) not in ('2023', '2024', '2025', '2026') then
    raise exception 'INVALID_REGNO_PREFIX: % — registration number "%" must start with 2023, 2024, 2025, or 2026', p_label, p_reg_no;
  end if;

  -- GITAM Email
  if v_blank_mail then
    if p_strict then raise exception 'MISSING_FIELD: % — GITAM Email is required', p_label; end if;
  elsif lower(p_gitam_email) !~ '@(gitam\.in|student\.gitam\.edu)$' then
    raise exception 'INVALID_EMAIL_DOMAIN: % — email "%" must end in @gitam.in or @student.gitam.edu', p_label, p_gitam_email;
  end if;

  -- Phone Number
  if v_blank_phone then
    if p_strict then raise exception 'MISSING_FIELD: % — Phone Number is required', p_label; end if;
  elsif p_phone !~ '^[0-9]{10}$' then
    raise exception 'INVALID_PHONE: % — phone "%" must be exactly 10 digits', p_label, p_phone;
  end if;

  -- Graduation
  if v_blank_grad then
    if p_strict then raise exception 'MISSING_FIELD: % — Graduation is required', p_label; end if;
  elsif p_graduation not in ('UG', 'PG') then
    raise exception 'INVALID_GRADUATION: % — graduation "%" must be UG or PG', p_label, p_graduation;
  end if;

  -- Program
  if v_blank_prog then
    if p_strict then raise exception 'MISSING_FIELD: % — Program is required', p_label; end if;
  elsif not v_blank_grad and (
        (p_graduation = 'UG' and p_program <> 'B.Tech')
     or (p_graduation = 'PG' and p_program <> 'M.Tech')
     or (p_graduation not in ('UG', 'PG'))
  ) then
    raise exception 'INVALID_PROGRAM_FOR_GRADUATION: % — program "%" is not valid for graduation "%"', p_label, p_program, p_graduation;
  end if;

  -- Year of Study
  if v_blank_year then
    if p_strict then raise exception 'MISSING_FIELD: % — Year of Study is required', p_label; end if;
  elsif not v_blank_prog and (
        (p_program = 'B.Tech' and p_year_of_study not in ('1st Year', '2nd Year', '3rd Year', '4th Year'))
     or (p_program = 'M.Tech' and p_year_of_study not in ('1st Year', '2nd Year'))
     or (p_program not in ('B.Tech', 'M.Tech'))
  ) then
    raise exception 'INVALID_YEAR_FOR_PROGRAM: % — year "%" is not valid for program "%"', p_label, p_year_of_study, p_program;
  end if;

  -- School
  if v_blank_schl then
    if p_strict then raise exception 'MISSING_FIELD: % — School is required', p_label; end if;
  elsif p_school not in ('GSCSE', 'GSCE') then
    raise exception 'INVALID_SCHOOL: % — school "%" must be GSCSE or GSCE', p_label, p_school;
  end if;

  -- Department
  if v_blank_dept then
    if p_strict then raise exception 'MISSING_FIELD: % — Department is required', p_label; end if;
  elsif not v_blank_schl and (
        (p_school = 'GSCSE' and p_department not in ('CSSE', 'AIDS'))
     or (p_school = 'GSCE'  and p_department not in ('EECE', 'MECH', 'CIVIL', 'BioTech', 'Aerospace Engineering'))
     or (p_school not in ('GSCSE', 'GSCE'))
  ) then
    raise exception 'INVALID_DEPARTMENT_FOR_SCHOOL: % — department "%" does not belong to school "%"', p_label, p_department, p_school;
  end if;

  -- Branch
  if v_blank_brnch then
    if p_strict then raise exception 'MISSING_FIELD: % — Branch is required', p_label; end if;
  elsif not v_blank_dept and not (
        (p_department = 'CSSE'  and p_branch in ('CSE', 'CSBS'))
     or (p_department = 'AIDS'  and p_branch in ('CSE-AIML', 'CSE-CS', 'CSE-DS', 'CSE-IOT'))
     or (p_department = 'EECE'  and p_branch = 'EECE')
     or (p_department = 'MECH'  and p_branch = 'MECH')
     or (p_department = 'CIVIL' and p_branch = 'CIVIL')
     or (p_department = 'BioTech' and p_branch = 'BioTech')
     or (p_department = 'Aerospace Engineering' and p_branch = 'Aerospace Engineering')
  ) then
    raise exception 'INVALID_BRANCH_FOR_DEPARTMENT: % — branch "%" does not belong to department "%"', p_label, p_branch, p_department;
  end if;

  -- Gender
  if v_blank_gen then
    if p_strict then raise exception 'MISSING_FIELD: % — Gender is required', p_label; end if;
  elsif p_gender not in ('Male', 'Female') then
    raise exception 'INVALID_GENDER: % — gender "%" must be Male or Female', p_label, p_gender;
  end if;

  -- Stay
  if v_blank_stay then
    if p_strict then raise exception 'MISSING_FIELD: % — Stay is required', p_label; end if;
  elsif p_stay not in ('Day Scholar', 'Hostel') then
    raise exception 'INVALID_STAY: % — stay "%" must be Day Scholar or Hostel', p_label, p_stay;
  end if;
end;
$$;

revoke all on function public.validate_member_academics(
  text, text, text, text, text, text, text, text, text, text, text, text, text, boolean
) from public, anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- register_team — source 0025. Adds a strict academic-validation pass over
-- every member and stamps graduation/program on the profile insert.
-- ══════════════════════════════════════════════════════════════════════════
create or replace function public.register_team(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_team_name text := p_payload->'team'->>'teamName';
  v_member_count int := (p_payload->'team'->>'memberCount')::int;
  v_campus text := p_payload->'team'->>'campus';
  v_members jsonb := p_payload->'members';
  v_team_id uuid;
  v_team_code text;
  v_member jsonb;
  v_pos bigint;
  v_idx int := 0;
  v_profile_id uuid;
  v_user_id text;
  v_user_ids text[] := '{}';
  v_lead_profile_id uuid;
begin
  if v_campus is null or v_campus not in ('VSP', 'BLR', 'HYD') then
    raise exception 'INVALID_CAMPUS';
  end if;

  if exists (select 1 from public.teams where team_name = v_team_name) then
    raise exception 'DUPLICATE_TEAM_NAME';
  end if;

  for v_member in select * from jsonb_array_elements(v_members) loop
    if exists (select 1 from public.profiles where gitam_email = lower(v_member->>'gitamEmail')) then
      raise exception 'DUPLICATE_EMAIL:%', v_member->>'gitamEmail';
    end if;
    if exists (select 1 from public.profiles where reg_no = v_member->>'regNo') then
      raise exception 'DUPLICATE_REGNO:%', v_member->>'regNo';
    end if;
    if exists (select 1 from public.profiles where phone = v_member->>'phone') then
      raise exception 'DUPLICATE_PHONE:%', v_member->>'phone';
    end if;
  end loop;

  for v_member, v_pos in
    select value, ordinality from jsonb_array_elements(v_members) with ordinality
  loop
    perform public.validate_member_academics(
      'Member ' || v_pos || coalesce(' (' || nullif(btrim(v_member->>'name'), '') || ')', ''),
      v_member->>'name', v_member->>'regNo', v_member->>'gitamEmail', v_member->>'phone',
      v_member->>'graduation', v_member->>'program', v_member->>'yearOfStudy',
      v_member->>'school', v_member->>'department', v_member->>'branch',
      v_member->>'gender', v_member->>'stay', true
    );
  end loop;

  v_team_code := public.next_team_id();

  insert into public.teams (team_id, team_name, member_count, status, campus)
  values (v_team_code, v_team_name, v_member_count, 'Registered', v_campus::public.campus)
  returning id into v_team_id;

  for v_member in select * from jsonb_array_elements(v_members) loop
    v_user_id := public.next_user_id(v_campus);

    insert into public.profiles (
      user_id, campus, role, name, gitam_email, phone, reg_no,
      graduation, program, year_of_study, school, department, branch, gender, stay
    ) values (
      v_user_id, v_campus::public.campus,
      case when v_idx = 0 then 'Team Lead' else 'Member' end::public.user_role,
      v_member->>'name', lower(v_member->>'gitamEmail'), v_member->>'phone', v_member->>'regNo',
      v_member->>'graduation', v_member->>'program',
      v_member->>'yearOfStudy', v_member->>'school', v_member->>'department',
      v_member->>'branch', v_member->>'gender', v_member->>'stay'
    ) returning id into v_profile_id;

    insert into public.team_members (team_id, profile_id, is_lead)
    values (v_team_id, v_profile_id, v_idx = 0);

    if v_idx = 0 then v_lead_profile_id := v_profile_id; end if;

    v_user_ids := array_append(v_user_ids, v_user_id);
    v_idx := v_idx + 1;
  end loop;

  update public.teams set team_lead_profile_id = v_lead_profile_id where id = v_team_id;

  return jsonb_build_object('team_id', v_team_code, 'user_ids', v_user_ids);

exception
  when unique_violation then
    raise exception 'DUPLICATE_ENTRY: %', sqlerrm;
end;
$$;

revoke all on function public.register_team(jsonb) from public, anon, authenticated;
grant execute on function public.register_team(jsonb) to service_role;

-- ══════════════════════════════════════════════════════════════════════════
-- update_member — source 0025. New signature: +p_graduation, +p_program.
-- Strict academic validation before the write.
-- ══════════════════════════════════════════════════════════════════════════
drop function if exists public.update_member(uuid, text, text, text, text, text, text, text, text, text, text);

create or replace function public.update_member(
  p_profile_id uuid,
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
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'PARTICIPANT_NOT_FOUND';
  end if;
  if (select campus from public.profiles where id = p_profile_id) is distinct from public.current_campus() then
    raise exception 'CROSS_CAMPUS';
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

  perform public.validate_member_academics(
    coalesce(nullif(btrim(p_name), ''), 'This member'),
    p_name, p_reg_no, p_gitam_email, p_phone,
    p_graduation, p_program, p_year_of_study,
    p_school, p_department, p_branch, p_gender, p_stay, true
  );

  update public.profiles set
    name = p_name,
    gitam_email = lower(p_gitam_email),
    phone = p_phone,
    reg_no = p_reg_no,
    graduation = p_graduation,
    program = p_program,
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
revoke all on function public.update_member(uuid, text, text, text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.update_member(uuid, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- resolve_approval_request — source 0025. Validate each member's resulting
-- academic block (lenient: legacy NULLs tolerated) and apply graduation/
-- program from the edit request too.
-- ══════════════════════════════════════════════════════════════════════════
create or replace function public.resolve_approval_request(p_request_id uuid, p_decision text)
returns void
language plpgsql security definer set search_path = public
as $$
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
  if not (public.is_assigned_spoc_of_team(v_team_id) or public.current_role() = 'Super Admin') then
    raise exception 'NOT_ALLOWED';
  end if;
  if (select t.campus from public.approval_requests ar join public.teams t on t.id = ar.team_id where ar.id = p_request_id) is distinct from public.current_campus() then
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
         else 'Your requested team changes were rejected — your previous info is unchanged.' end
  );
end;
$$;

revoke all on function public.resolve_approval_request(uuid, text) from public, anon;
grant execute on function public.resolve_approval_request(uuid, text) to authenticated;
