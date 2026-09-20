-- 0082_seed_grand_finale.sql
-- Seeds the Grand Finale (University Level) date/venue with the organizers'
-- confirmed values, so the homepage's Journey section shows them
-- immediately rather than "to be announced" until someone clicks through
-- the new Configuration fields (ConfigurationSection.tsx) by hand. Still
-- fully editable there afterward — this is just the starting value.

insert into public.configuration (key, value, description, updated_at)
values
  ('grand_finale.start', '"2026-10-17T10:00:00+05:30"'::jsonb, 'Grand Finale (University Level) start date and time.', now()),
  ('grand_finale.end', '"2026-10-18T10:00:00+05:30"'::jsonb, 'Grand Finale (University Level) end date and time.', now()),
  ('grand_finale.venue', '"Shivaji Auditorium, ICT Bhavan, Visakhapatnam Campus"'::jsonb, 'Grand Finale (University Level) venue.', now())
on conflict (key) do update
  set value = excluded.value, description = excluded.description, updated_at = now();
