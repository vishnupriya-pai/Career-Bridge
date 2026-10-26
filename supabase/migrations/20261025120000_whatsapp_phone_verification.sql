alter table public.profiles
  add column if not exists phone_verified boolean not null default false;

-- A changed phone number must be verified again. Clients cannot set this flag.
create or replace function private.reset_phone_verification_on_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.phone is distinct from old.phone then
    new.phone_verified := false;
    new.whatsapp_opt_in := false;
  end if;
  return new;
end $$;
revoke all on function private.reset_phone_verification_on_change() from public, anon, authenticated;
drop trigger if exists profiles_reset_phone_verification on public.profiles;
create trigger profiles_reset_phone_verification
  before update of phone on public.profiles
  for each row execute function private.reset_phone_verification_on_change();
revoke update(phone_verified) on public.profiles from authenticated;
grant update(phone_verified) on public.profiles to service_role;
