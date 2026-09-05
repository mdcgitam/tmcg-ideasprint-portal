-- The Notifications page only ever refreshed on a full page load/navigation
-- — a new broadcast or NOC/PPT/approval notice didn't show up until the
-- user manually reloaded. Adding the table to the supabase_realtime
-- publication lets the client subscribe to postgres_changes and pick up
-- new rows (and read-state changes from another tab/device) live.

-- Guarded: erroring if the table is already in the publication would be an
-- easy way to break this migration on a project where it was added by hand.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
