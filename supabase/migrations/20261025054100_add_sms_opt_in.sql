alter table public.profiles
  add column if not exists sms_opt_in boolean not null default false;

grant update(sms_opt_in) on public.profiles to authenticated;