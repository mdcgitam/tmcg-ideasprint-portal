-- Two-tier admin model. The role formerly called 'Super Admin' was campus-bound
-- (0025 campus isolation) — rename it to 'Campus Admin' and add a new global
-- 'Super Admin' that sits above the campus admins.
--
-- RENAME VALUE is identity-preserving: every RLS policy and function that
-- referenced the old value now transparently references 'Campus Admin', so
-- campus scoping keeps working. ADD VALUE must not be used in the same
-- transaction it is created in, so the platform-admin wiring (helper,
-- policy bypass, RPC auth, staff-creation split, seed) lives in 0031.

alter type public.user_role rename value 'Super Admin' to 'Campus Admin';
alter type public.user_role add value 'Super Admin';
