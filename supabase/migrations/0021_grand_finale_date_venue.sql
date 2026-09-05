-- Grand Finale ("University Level") date/venue, now confirmed by the
-- organizers — same key/value config the homepage Journey section already
-- reads (src/app/(public)/page.tsx) and the admin Configuration page
-- already lets Super Admin edit/override (grand_finale.date/.venue).

insert into public.configuration (key, value, description)
values
  ('grand_finale.date', to_jsonb('2nd & 3rd October 2026, 2:00 PM'::text), 'Homepage Journey section — Grand Finale (University Level) date, shown until overridden here.'),
  ('grand_finale.venue', to_jsonb('Shivaji Auditorium, Visakhapatnam'::text), 'Homepage Journey section — Grand Finale (University Level) venue, shown until overridden here.')
on conflict (key) do update set value = excluded.value, updated_at = now();
