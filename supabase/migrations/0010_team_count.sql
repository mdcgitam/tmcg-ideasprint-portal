-- Public, read-only team count for the homepage's "registrations closed"
-- popup. The teams table itself has no public SELECT policy, so this
-- SECURITY DEFINER wrapper is the only way an anonymous visitor can learn
-- how many teams have registered without exposing any row data.

create or replace function public.get_confirmed_team_count()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.teams;
$$;
revoke all on function public.get_confirmed_team_count() from public;
grant execute on function public.get_confirmed_team_count() to anon, authenticated;
