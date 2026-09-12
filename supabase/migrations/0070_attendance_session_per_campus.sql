-- 0070_attendance_session_per_campus.sql
-- Attendance sessions were purely global (0069 restricted who could add
-- one, but every session still applied to all 3 campuses). Extends that:
-- a Super Admin can now add a session scoped to just one campus (e.g. an
-- extra session for VSP only) in addition to the existing global ones —
-- created while viewing "All" -> campus stays null (applies everywhere,
-- unchanged behavior); created while viewing one campus module -> tagged
-- with that campus and only shown there.

alter table public.attendance_sessions add column campus public.campus;

drop function if exists public.create_attendance_session(text, timestamptz, timestamptz, integer);

create or replace function public.create_attendance_session(
  p_name text, p_starts_at timestamptz, p_ends_at timestamptz, p_sort_order integer, p_campus text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_campus is not null and p_campus not in ('VSP', 'BLR', 'HYD') then
    raise exception 'INVALID_CAMPUS';
  end if;

  insert into public.attendance_sessions (name, starts_at, ends_at, sort_order, campus)
  values (p_name, p_starts_at, p_ends_at, coalesce(p_sort_order, 0), p_campus::public.campus)
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.create_attendance_session(text, timestamptz, timestamptz, integer, text) from public, anon;
grant execute on function public.create_attendance_session(text, timestamptz, timestamptz, integer, text) to authenticated;
