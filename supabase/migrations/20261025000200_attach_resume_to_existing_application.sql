alter table public.applications add column if not exists resume_path text;
alter table public.applications add column if not exists resume_filename text;
grant update(resume_path,resume_filename) on public.applications to authenticated;

drop policy if exists "candidate adds missing resume to own application" on public.applications;
create policy "candidate adds missing resume to own application"
on public.applications for update to authenticated
using ((select auth.uid())=user_id and resume_path is null)
with check (
  (select auth.uid())=user_id
  and resume_path is not null
  and resume_filename is not null
  and resume_path like user_id::text || '/' || job_id::text || '/%'
);

create or replace function private.guard_candidate_application_resume_update()
returns trigger language plpgsql set search_path='' as $$
begin
  if (select auth.uid())=old.user_id
    and not (select private.is_admin())
    and not (select private.is_coordinator())
    and (
      old.resume_path is not null
      or new.resume_path is null
      or new.user_id is distinct from old.user_id
      or new.job_id is distinct from old.job_id
      or new.status is distinct from old.status
      or new.created_at is distinct from old.created_at
    ) then
    raise exception 'Candidates may only attach a resume to an application without one';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_candidate_application_resume_update() from public,anon,authenticated;
drop trigger if exists guard_candidate_application_resume_update on public.applications;
create trigger guard_candidate_application_resume_update
before update on public.applications
for each row execute function private.guard_candidate_application_resume_update();

drop policy if exists "candidate deletes own application resume" on storage.objects;
create policy "candidate deletes own unlinked application resume"
on storage.objects for delete to authenticated
using (
  bucket_id='candidate-resumes'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and not exists (
    select 1 from public.applications a
    where a.user_id::text=(storage.foldername(name))[1]
      and a.job_id::text=(storage.foldername(name))[2]
      and a.resume_path=name
  )
);