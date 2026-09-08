-- ID Cards & Certificates module — same shape as Attendance (one status
-- record per participant per "item", team-level rollup = Completed only
-- when every active member is Completed), but the item list is the fixed
-- pair ("ID Card", "Certificate") rather than an admin-managed, growable
-- session list — so there's no create_*_session equivalent here.

create type public.id_card_cert_status as enum ('Completed', 'Pending');

create table public.id_card_certificate_records (
  id uuid primary key default gen_random_uuid(),
  item text not null check (item in ('ID Card', 'Certificate')),
  profile_id uuid not null references public.profiles(id),
  team_id uuid not null references public.teams(id),
  status public.id_card_cert_status not null,
  recorded_by uuid not null references public.profiles(id),
  recorded_at timestamptz not null default now(),
  unique (item, profile_id)
);

alter table public.id_card_certificate_records enable row level security;

-- SELECT-only policy, same predicate shape as attendance_select — every
-- write goes through record_id_card_certificate (security definer) below.
create policy id_card_certificate_records_select on public.id_card_certificate_records as permissive for SELECT to authenticated
using (
  (
    (team_id = current_team_id())
    OR (team_id IN (SELECT teams.id FROM teams WHERE teams.spoc_profile_id = current_profile_id()))
    OR public.is_zone_manager_of_team(id_card_certificate_records.team_id)
    OR (("current_role"() = 'Campus Admin'::user_role) AND ((SELECT t.campus FROM teams t WHERE t.id = id_card_certificate_records.team_id) = current_campus()))
  )
  OR public.is_platform_admin()
);

-- record_id_card_certificate: same guard shape as record_attendance (an
-- exited member / Inactive team can't be marked).
create or replace function public.record_id_card_certificate(p_item text, p_profile_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_team_id uuid;
  v_existing_id uuid;
begin
  if p_item not in ('ID Card', 'Certificate') then
    raise exception 'INVALID_ITEM';
  end if;
  if p_status not in ('Completed', 'Pending') then
    raise exception 'INVALID_STATUS';
  end if;

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

  select id into v_existing_id from public.id_card_certificate_records where item = p_item and profile_id = p_profile_id;

  if v_existing_id is null then
    insert into public.id_card_certificate_records (item, profile_id, team_id, status, recorded_by)
    values (p_item, p_profile_id, v_team_id, p_status::public.id_card_cert_status, public.current_profile_id());
  else
    update public.id_card_certificate_records
    set status = p_status::public.id_card_cert_status, recorded_by = public.current_profile_id(), recorded_at = now()
    where id = v_existing_id;
  end if;
end;
$$;
revoke all on function public.record_id_card_certificate(text, uuid, text) from public, anon;
grant execute on function public.record_id_card_certificate(text, uuid, text) to authenticated;
