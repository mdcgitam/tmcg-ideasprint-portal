-- 0055_staff_manual_sort_order.sql
-- Staff Accounts groups rows by Campus then Role, but within a group (e.g.
-- "VSP Zone Managers") there's no natural sort — zone/venue names aren't
-- alphabetically or numerically meaningful, so a Campus Admin wants to
-- drag rows into whatever order matches their actual zone/venue layout.
--
-- staff_sort_order is nullable and only ever set by reorder_staff below
-- (dragging a row) — untouched rows stay null and keep falling back to
-- the existing created_at ordering, so nothing changes until someone
-- actually drags something. It's a plain integer, not required to be
-- globally unique — it's only ever compared between rows in the same
-- (campus, role) group, which the client guarantees when it calls this.

alter table public.profiles add column staff_sort_order integer;

create or replace function public.reorder_staff(p_profile_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_idx integer := 0;
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;

  foreach v_id in array p_profile_ids loop
    if not exists (select 1 from public.profiles where id = v_id and role in ('SPOC', 'Zone Manager', 'Campus Admin')) then
      raise exception 'NOT_ALLOWED';
    end if;
    if not public.is_platform_admin()
       and (select campus from public.profiles where id = v_id) is distinct from public.current_campus() then
      raise exception 'CROSS_CAMPUS';
    end if;
    update public.profiles set staff_sort_order = v_idx where id = v_id;
    v_idx := v_idx + 1;
  end loop;
end;
$$;
revoke all on function public.reorder_staff(uuid[]) from public, anon;
grant execute on function public.reorder_staff(uuid[]) to authenticated;
