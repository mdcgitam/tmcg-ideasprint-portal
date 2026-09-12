-- 0069_attendance_session_super_admin_only.sql
-- Attendance sessions are global (no campus column — every campus already
-- shares the same list), so letting each of the three Campus Admins add
-- their own independently risks divergent/duplicate session names across
-- campuses. Restrict creation to Super Admin only, matching the "Add
-- Session" button now only rendering for Super Admin viewing "All" on the
-- frontend.

create or replace function public.create_attendance_session(p_name text, p_starts_at timestamptz, p_ends_at timestamptz, p_sort_order integer)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'NOT_ALLOWED';
  end if;

  insert into public.attendance_sessions (name, starts_at, ends_at, sort_order)
  values (p_name, p_starts_at, p_ends_at, coalesce(p_sort_order, 0))
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.create_attendance_session(text, timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.create_attendance_session(text, timestamptz, timestamptz, integer) to authenticated;
