-- Corrective fix, caught by supabase/audit_check.sql: the assigned SPOC was
-- given permission to replace/delete a team's NOC at the RPC level
-- (delete_noc, widened in 0003) and the migration file for the storage
-- policies below was updated to match at the same time, but the actual
-- ALTER POLICY was never run against this project — noc_uploads_update and
-- noc_uploads_delete were still Team Lead/Super Admin only. Postgres won't
-- let CREATE OR REPLACE touch a policy — ALTER POLICY redefines the
-- existing one's expressions in place, no DROP needed first.

alter policy noc_uploads_update on storage.objects
using (
  bucket_id = 'noc-uploads'
  and (
    public.is_led_profile((storage.foldername(name))[1]::uuid)
    or public.is_assigned_spoc_of_profile((storage.foldername(name))[1]::uuid)
    or public.current_role() = 'Super Admin'
  )
)
with check (
  bucket_id = 'noc-uploads'
  and (
    public.is_led_profile((storage.foldername(name))[1]::uuid)
    or public.is_assigned_spoc_of_profile((storage.foldername(name))[1]::uuid)
    or public.current_role() = 'Super Admin'
  )
);

alter policy noc_uploads_delete on storage.objects
using (
  bucket_id = 'noc-uploads'
  and (
    public.is_led_profile((storage.foldername(name))[1]::uuid)
    or public.is_assigned_spoc_of_profile((storage.foldername(name))[1]::uuid)
    or public.current_role() = 'Super Admin'
  )
);
