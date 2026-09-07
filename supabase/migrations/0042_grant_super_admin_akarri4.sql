-- Promote akarri4@gitam.in from Campus Admin (VSP) to the global Super Admin role.
update public.profiles set role = 'Super Admin', campus = null
where gitam_email = 'akarri4@gitam.in';
