-- 0050_delete_campus_admin.sql
-- create_campus_admin (0031) has never had a matching delete — only
-- delete_spoc and delete_zone_manager exist, so a Campus Admin account
-- could be created but never removed, which is why Staff Accounts never
-- showed a Delete button for one. Campus Admin creation and promotion
-- (create_campus_admin, update_user_role's Campus Admin branch) are
-- already Super-Admin-only, so deletion follows the same boundary — a
-- Campus Admin can delete a SPOC/Zone Manager in their own campus, but
-- never a peer Campus Admin.

create or replace function public.delete_campus_admin(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'NOT_ALLOWED'; end if;
  if not exists (select 1 from public.profiles where id = p_profile_id and role = 'Campus Admin') then
    raise exception 'NOT_A_CAMPUS_ADMIN';
  end if;

  delete from public.profiles where id = p_profile_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'Campus Admin Deleted', 'profile', p_profile_id);
end;
$$;
revoke all on function public.delete_campus_admin(uuid) from public, anon;
grant execute on function public.delete_campus_admin(uuid) to authenticated;
