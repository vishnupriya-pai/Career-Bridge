-- Permit candidates and staff to edit their own profile row. The authenticated
-- role has only column-level UPDATE grants for editable fields, so role and
-- other protected columns remain unmodifiable by clients.
drop policy if exists "owner edits own profile" on public.profiles;
drop policy if exists "users edit own profile" on public.profiles;

create policy "users edit own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
