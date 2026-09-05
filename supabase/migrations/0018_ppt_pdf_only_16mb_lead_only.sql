-- Presentation (PPT) uploads: restrict to PDF only, cap at 16MB, and close
-- the storage-level Super Admin insert/update loophole so uploading is
-- exclusively a Team Lead action (record_presentation's RPC check already
-- enforced this; storage.objects allowed Super Admin through independently).

update storage.buckets
set file_size_limit = 16777216,
    allowed_mime_types = array['application/pdf']
where id = 'ppt-uploads';

drop policy if exists ppt_uploads_insert on storage.objects;
create policy ppt_uploads_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'ppt-uploads'
  and public.is_led_team((storage.foldername(name))[1]::uuid)
);

drop policy if exists ppt_uploads_update on storage.objects;
create policy ppt_uploads_update on storage.objects for update to authenticated
using (
  bucket_id = 'ppt-uploads'
  and public.is_led_team((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'ppt-uploads'
  and public.is_led_team((storage.foldername(name))[1]::uuid)
);
