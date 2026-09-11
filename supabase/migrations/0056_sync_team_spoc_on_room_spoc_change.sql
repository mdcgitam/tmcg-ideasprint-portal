-- 0056_sync_team_spoc_on_room_spoc_change.sql
-- teams.spoc_profile_id is a snapshot, not a live lookup — assign_team_to_room
-- (0025) copies the room's current SPOC onto every team placed in it. That's
-- fine for teams assigned AFTER a room has its SPOC, but assign_spoc_to_room
-- (0043) only ever wrote rooms.spoc_profile_id — it never went back and
-- updated the teams already sitting in that room. So a room created without
-- a SPOC (or with its SPOC later changed) leaves every team already in it
-- pointing at the old/null SPOC:
--   - The Team dashboard reads teams.spoc_profile_id for its SPOC field, so
--     it shows "Not yet assigned" even though the admin has assigned one.
--   - SPOC visibility of "their" teams is gated by RLS checking
--     teams.spoc_profile_id = current_profile_id() directly (0001, 0036) —
--     a newly-assigned SPOC couldn't even see the teams already in their
--     room.
-- Fix: propagate to every team currently in the room, same as
-- assign_team_to_room already does at the other end of this relationship.

create or replace function public.assign_spoc_to_room(p_room_id uuid, p_spoc_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_existing_room text;
begin
  if not (public.current_role() = 'Campus Admin' or public.is_platform_admin()) then raise exception 'NOT_ALLOWED'; end if;
  if p_spoc_profile_id is not null and (select campus from public.profiles where id = p_spoc_profile_id) is distinct from (select campus from public.rooms where id = p_room_id) then raise exception 'CROSS_CAMPUS'; end if;
  if p_spoc_profile_id is not null and not exists (select 1 from public.profiles where id = p_spoc_profile_id and role = 'SPOC') then
    raise exception 'NOT_A_SPOC';
  end if;
  if p_spoc_profile_id is not null then
    select name into v_existing_room from public.rooms where spoc_profile_id = p_spoc_profile_id and id <> p_room_id limit 1;
    if v_existing_room is not null then
      raise exception 'SPOC_ALREADY_ASSIGNED:%', v_existing_room;
    end if;
  end if;

  update public.rooms set spoc_profile_id = p_spoc_profile_id, updated_at = now() where id = p_room_id;
  update public.teams set spoc_profile_id = p_spoc_profile_id, updated_at = now() where room_id = p_room_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id, new_value)
  values (public.current_profile_id(), 'Room SPOC Assigned', 'room', p_room_id, jsonb_build_object('spoc_profile_id', p_spoc_profile_id));
end;
$$;
revoke all on function public.assign_spoc_to_room(uuid, uuid) from public, anon;
grant execute on function public.assign_spoc_to_room(uuid, uuid) to authenticated;

-- One-time backfill for rooms/teams already out of sync from before this fix.
update public.teams t
set spoc_profile_id = r.spoc_profile_id, updated_at = now()
from public.rooms r
where t.room_id = r.id
  and t.spoc_profile_id is distinct from r.spoc_profile_id;
