-- 0037_sync_team_member_count.sql
-- teams.member_count was a static column set at registration and never
-- adjusted afterwards, so deleting a participant left it stale. Some
-- dashboards show the live roster length (team_members join) and some show
-- the stale column, so the two disagree after any member deletion.
--
-- Fix: a trigger keeps teams.member_count equal to the real team_members
-- count for that team, on every insert/delete. The old CHECK pinned the
-- column to exactly 3 or 4 — true only at registration — so it is widened
-- to 1..4 (a team can shrink to just its lead after deletions; it can
-- never exceed 4).
--
-- Applied statement-by-statement (simple protocol), same as prior migrations.

-- Widen the CHECK (drop whatever it's named, re-add).
do $$
declare c text;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public' and rel.relname = 'teams' and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%member_count%'
  loop
    execute format('alter table public.teams drop constraint %I', c);
  end loop;
end $$;

alter table public.teams
  add constraint teams_member_count_check check (member_count between 1 and 4);

-- Keep the count in sync with the roster.
create or replace function public.sync_team_member_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_team_id uuid := coalesce(new.team_id, old.team_id);
begin
  update public.teams t
     set member_count = greatest(1, (select count(*) from public.team_members tm where tm.team_id = v_team_id)),
         updated_at = now()
   where t.id = v_team_id
     and exists (select 1 from public.teams where id = v_team_id);
  return null;
end;
$$;

drop trigger if exists trg_sync_team_member_count on public.team_members;
create trigger trg_sync_team_member_count
after insert or delete on public.team_members
for each row execute function public.sync_team_member_count();

-- One-time backfill for rows that have already drifted.
update public.teams t
   set member_count = c.n
  from (select team_id, count(*) as n from public.team_members group by team_id) c
 where c.team_id = t.id
   and t.member_count is distinct from c.n
   and c.n between 1 and 4;
