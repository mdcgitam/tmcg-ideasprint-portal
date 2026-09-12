-- 0073_team_active_flag.sql
-- A team can be fully registered and assigned a Zone/Venue/SPOC, then
-- simply never show up on the day of the event. There was no way to
-- record that distinct from an exit (profiles.is_active, driven by the
-- reviewed exit_requests flow) — deleting the team isn't an option (the
-- registration record itself needs to survive), and leaving them shown
-- as a normal active team everywhere is misleading.
--
-- teams.is_active is a new, independent flag — not derived from or
-- cascaded into member-level is_active, and not tied to any exit
-- request. It only ever means "did this team actually participate",
-- toggled directly by an admin/SPOC/Zone Manager, and trivially
-- reversible (a late-arriving team is one flip back to active).
--
-- Same permission shape as record_attendance: is_assigned_spoc_of_team
-- already folds in Zone Manager (0036), so SPOC, Zone Manager, Campus
-- Admin, and Super Admin can all flip it; nobody else.

alter table public.teams add column is_active boolean not null default true;

create or replace function public.set_team_active(p_team_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_assigned_spoc_of_team(p_team_id) or public.current_role() = 'Campus Admin' or public.is_platform_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.is_platform_admin() and ((select campus from public.teams where id = p_team_id) is distinct from public.current_campus()) then
    raise exception 'CROSS_CAMPUS';
  end if;

  update public.teams set is_active = p_active, updated_at = now() where id = p_team_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (
    public.current_profile_id(),
    case when p_active then 'Team Marked Active' else 'Team Marked No-Show' end,
    'team',
    p_team_id,
    jsonb_build_object('is_active', p_active)
  );
end;
$$;
revoke all on function public.set_team_active(uuid, boolean) from public, anon;
grant execute on function public.set_team_active(uuid, boolean) to authenticated;
