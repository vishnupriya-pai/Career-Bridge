alter table public.applications add column if not exists resume_path text;
alter table public.applications add column if not exists resume_filename text;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'candidate-resumes',
  'candidate-resumes',
  false,
  10485760,
  array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]
)
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "candidate uploads own application resume" on storage.objects;
create policy "candidate uploads own application resume"
on storage.objects for insert to authenticated
with check (
  bucket_id='candidate-resumes'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

drop policy if exists "candidate and assigned staff read application resume" on storage.objects;
create policy "candidate and assigned staff read application resume"
on storage.objects for select to authenticated
using (
  bucket_id='candidate-resumes'
  and (
    (storage.foldername(name))[1]=(select auth.uid())::text
    or (select private.is_admin())
    or exists (
      select 1 from public.applications a
      join public.jobs j on j.id=a.job_id
      where a.user_id::text=(storage.foldername(name))[1]
        and a.job_id::text=(storage.foldername(name))[2]
        and j.coordinator_id=(select auth.uid())
        and (select private.is_coordinator())
    )
  )
);

drop policy if exists "candidate deletes own application resume" on storage.objects;
create policy "candidate deletes own application resume"
on storage.objects for delete to authenticated
using (
  bucket_id='candidate-resumes'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);