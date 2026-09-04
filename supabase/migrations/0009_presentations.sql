-- Team presentation (PPT) uploads — same shape and access pattern as
-- exit_forms (one row per team, Team Lead uploads, Super Admin/assigned
-- SPOC can view and delete), surfaced together with NOCs in the admin
-- dashboard's "NOC & PPT" box.

create type public.presentation_status as enum ('Not Uploaded', 'Uploaded');

create table public.presentations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid unique not null references public.teams(id),
  file_path text,
  status public.presentation_status not null default 'Not Uploaded',
  uploaded_by uuid references public.profiles(id),
  uploaded_at timestamptz
);

alter table public.presentations enable row level security;

create policy presentations_select on public.presentations for select to authenticated
using (
  team_id = public.current_team_id()
  or team_id in (select id from public.teams where spoc_profile_id = public.current_profile_id())
  or public.current_role() = 'Super Admin'
);

-- ── Storage bucket ───────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ppt-uploads', 'ppt-uploads', false, 20971520,
  array[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
);

-- Path convention matches exit-forms: ppt-uploads/{team_id}/{filename}.
create policy ppt_uploads_select on storage.objects for select to authenticated
using (
  bucket_id = 'ppt-uploads'
  and (
    public.is_own_team((storage.foldername(name))[1]::uuid)
    or public.is_assigned_spoc_of_team((storage.foldername(name))[1]::uuid)
    or public.current_role() = 'Super Admin'
  )
);

create policy ppt_uploads_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'ppt-uploads'
  and (public.is_led_team((storage.foldername(name))[1]::uuid) or public.current_role() = 'Super Admin')
);

create policy ppt_uploads_update on storage.objects for update to authenticated
using (
  bucket_id = 'ppt-uploads'
  and (public.is_led_team((storage.foldername(name))[1]::uuid) or public.current_role() = 'Super Admin')
)
with check (
  bucket_id = 'ppt-uploads'
  and (public.is_led_team((storage.foldername(name))[1]::uuid) or public.current_role() = 'Super Admin')
);

create policy ppt_uploads_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'ppt-uploads'
  and (public.is_led_team((storage.foldername(name))[1]::uuid) or public.current_role() = 'Super Admin')
);

-- ── RPCs ─────────────────────────────────────────────────────────────────

create or replace function public.record_presentation(p_team_id uuid, p_file_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_led_team(p_team_id) then raise exception 'NOT_TEAM_LEAD'; end if;

  insert into public.presentations (team_id, file_path, status, uploaded_by, uploaded_at)
  values (p_team_id, p_file_path, 'Uploaded', public.current_profile_id(), now())
  on conflict (team_id) do update
    set file_path = excluded.file_path, status = 'Uploaded',
        uploaded_by = excluded.uploaded_by, uploaded_at = excluded.uploaded_at;

  insert into public.notifications (recipient_profile_id, type, title, message)
  select id, 'PresentationUploaded', 'Presentation uploaded', 'A team presentation (PPT) was uploaded.'
  from public.profiles
  where role = 'Super Admin' or id = (select spoc_profile_id from public.teams where id = p_team_id);
end;
$$;
revoke all on function public.record_presentation(uuid, text) from public, anon;
grant execute on function public.record_presentation(uuid, text) to authenticated;

create or replace function public.delete_presentation(p_team_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_led_team(p_team_id) or public.current_role() = 'Super Admin') then
    raise exception 'NOT_ALLOWED';
  end if;

  update public.presentations set status = 'Not Uploaded', file_path = null where team_id = p_team_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'Presentation Deleted', 'presentation', p_team_id);
end;
$$;
revoke all on function public.delete_presentation(uuid) from public, anon;
grant execute on function public.delete_presentation(uuid) to authenticated;

-- delete_team (0006) must also clean up presentations — same "no ON DELETE
-- clause on team_id" reasoning as the existing exit_forms line.
create or replace function public.delete_team(p_team_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_profile_id uuid;
begin
  if public.current_role() <> 'Super Admin' then raise exception 'NOT_ALLOWED'; end if;
  if not exists (select 1 from public.teams where id = p_team_id) then raise exception 'TEAM_NOT_FOUND'; end if;

  update public.teams set team_lead_profile_id = null where id = p_team_id;

  for v_profile_id in select profile_id from public.team_members where team_id = p_team_id loop
    delete from public.attendance where profile_id = v_profile_id;
    delete from public.food_coupons where profile_id = v_profile_id;
    delete from public.nocs where profile_id = v_profile_id;
  end loop;

  delete from public.exit_forms where team_id = p_team_id;
  delete from public.presentations where team_id = p_team_id;

  delete from public.profiles where id in (select profile_id from public.team_members where team_id = p_team_id);

  delete from public.teams where id = p_team_id;

  insert into public.audit_logs (actor_profile_id, action, entity_type, entity_id)
  values (public.current_profile_id(), 'Team Deleted', 'team', p_team_id);
end;
$$;
revoke all on function public.delete_team(uuid) from public, anon;
grant execute on function public.delete_team(uuid) to authenticated;
